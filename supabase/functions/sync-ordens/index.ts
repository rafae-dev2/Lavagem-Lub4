import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.1';
import { SourceValidationError, validateSourcePayload } from './validation.ts';

const SOURCE_URL = 'https://ti.usinabrancoperes.com.br/ordens-pims/dados/ordens.json';
const SOURCE_TIMEOUT_MS = 20_000;
const ALLOWED_AGE_MINUTES = 75;
const FUTURE_TOLERANCE_MINUTES = 5;

type JsonRecord = Record<string, unknown>;

let runtimeOrigins = new Set<string>();
let runtimeSecret = '';
let runtimeLoadedAt = 0;

async function loadRuntimeConfig(): Promise<void> {
  if (runtimeLoadedAt && Date.now() - runtimeLoadedAt < 30_000) return;
  const { data, error } = await adminClient().rpc('obter_apoio_runtime_config');
  if (error) throw new Error(`Configuração do servidor: ${error.message}`);
  runtimeOrigins = new Set(String(data?.allowed_origins || Deno.env.get('APOIO_ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean));
  runtimeSecret = String(data?.sync_secret || Deno.env.get('APOIO_SYNC_SECRET') || '');
  if (!runtimeSecret) throw new Error('Segredo privado do agendamento não configurado no Vault.');
  runtimeLoadedAt = Date.now();
}

function allowedOrigins(): Set<string> { return runtimeOrigins; }

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-sync-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
  if (origin && allowedOrigins().has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

function jsonResponse(
  body: JsonRecord,
  status: number,
  origin: string | null,
): Response {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados na Edge Function');
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'branco-peres-apoio-sync' } },
  });
}

function serverSecretIsValid(request: Request): boolean {
  const presented = request.headers.get('x-sync-secret');
  if (!presented) return false;
  const expected = runtimeSecret;
  return Boolean(expected && presented === expected);
}

async function fetchSource(): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(SOURCE_URL, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) throw new Error(`fonte retornou HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error('fonte retornou JSON inválido');
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function recordSyncError(admin: ReturnType<typeof adminClient>, message: string, token: string): Promise<void> {
  const { error } = await admin.rpc('falhar_apoio_sync', {
    p_erro: message.slice(0, 2000), p_token: token,
  });
  if (error) throw new Error(`não foi possível registrar erro de sincronização: ${error.message}`);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('origin');
  try { await loadRuntimeConfig(); }
  catch (error) { return jsonResponse({ ok: false, erro: errorMessage(error) }, 503, origin); }
  const origins = allowedOrigins();

  if (request.method === 'OPTIONS') {
    if (origin && !origins.has(origin)) {
      return jsonResponse({ ok: false, erro: 'origem não permitida' }, 403, null);
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, erro: 'método não permitido' }, 405, origin && origins.has(origin) ? origin : null);
  }
  // Origem é opcional para chamadas de servidor. Quando presente, nunca é
  // refletida cegamente: precisa estar na allowlist configurada.
  if (origin && !origins.has(origin)) {
    return jsonResponse({ ok: false, erro: 'origem não permitida' }, 403, null);
  }

  const presentedSecret = request.headers.get('x-sync-secret');
  if (presentedSecret && !serverSecretIsValid(request)) {
    return jsonResponse({ ok: false, erro: 'segredo de sincronização inválido' }, 401, origin);
  }

  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch (error) {
    return jsonResponse({ ok: false, erro: errorMessage(error) }, 500, origin);
  }

  let claimed = false;
  let claimToken: string | null = null;
  try {
    const claim = await admin.rpc('iniciar_apoio_sync');
    if (claim.error) throw new Error(`claim de sincronização: ${claim.error.message}`);
    if (!claim.data) {
      return jsonResponse({ ok: true, throttled: true, mensagem: 'consulta recente já em andamento ou concluída' }, 200, origin);
    }
    claimed = true;
    claimToken = String(claim.data);

    const rawPayload = await fetchSource();
    const payload = validateSourcePayload(
      rawPayload,
      new Date(),
    );

    const applied = await admin.rpc('concluir_apoio_sync', {
      p_payload: payload, p_token: claimToken,
    });
    if (applied.error) throw new Error(`aplicação transacional: ${applied.error.message}`);

    return jsonResponse({
      ok: true,
      throttled: false,
      aplicado: applied.data,
      fonte: SOURCE_URL,
      idade_maxima_minutos: ALLOWED_AGE_MINUTES,
      tolerancia_futuro_minutos: FUTURE_TOLERANCE_MINUTES,
    }, 200, origin);
  } catch (error) {
    const message = error instanceof SourceValidationError
      ? `payload da fonte rejeitado: ${error.message}`
      : errorMessage(error);
    if (claimed) {
      try {
        await recordSyncError(admin, message, claimToken!);
      } catch (recordError) {
        return jsonResponse({
          ok: false,
          erro: message,
          registro_erro: errorMessage(recordError),
        }, 500, origin);
      }
    }
    return jsonResponse({ ok: false, erro: message }, 502, origin);
  }
});
