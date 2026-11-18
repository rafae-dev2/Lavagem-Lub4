/**
 * Fluxo seguro de autenticação do editor de imagens.
 *
 * Estes helpers são deliberadamente puros: não fazem fetch, não abrem links,
 * não gravam credenciais e nunca aceitam access_token vindo de uma URL.
 */
import { SUPABASE_URL } from './supabaseClient';

export const EDITOR_EMAIL_OTP_TYPES = ['magiclink', 'signup', 'email'] as const;
export type EditorEmailOtpType = (typeof EDITOR_EMAIL_OTP_TYPES)[number];
export type EditorCredentialMode = 'auto' | 'link' | 'code';

export type EditorCredential =
  | {
      kind: 'link';
      token_hash: string;
      type: EditorEmailOtpType;
    }
  | {
      kind: 'code';
      token: string;
      type: 'email';
    };

export type EditorVerifyOtpParams =
  | { token_hash: string; type: EditorEmailOtpType }
  | { email: string; token: string; type: 'email' };

export type EditorAuthUrlError = {
  code: string;
  error?: string;
};

const SUPABASE_AUTH_VERIFY = new URL('/auth/v1/verify', SUPABASE_URL);
const CODE_PATTERN = /^\d{6,8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRED_CODES = new Set(['otp_expired', 'token_expired', 'expired']);
const USED_CODES = new Set(['otp_already_used', 'already_used', 'invalid_token', 'token_not_found']);

function allowedType(value: string | null): value is EditorEmailOtpType {
  return Boolean(value && (EDITOR_EMAIL_OTP_TYPES as readonly string[]).includes(value));
}

function parseVerificationLink(value: string): EditorCredential | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // A pasted email link must be the exact HTTPS Supabase verification endpoint.
  if (
    url.protocol !== 'https:' ||
    url.origin !== SUPABASE_AUTH_VERIFY.origin ||
    url.hostname !== SUPABASE_AUTH_VERIFY.hostname ||
    url.pathname !== SUPABASE_AUTH_VERIFY.pathname ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }

  // Never turn an implicit-flow URL into a token-hash verification request.
  if (url.searchParams.has('access_token') || url.searchParams.has('refresh_token') || url.searchParams.has('token_type')) {
    return null;
  }

  const token = url.searchParams.get('token');
  const tokenHash = url.searchParams.get('token_hash');
  if ((url.searchParams.has('token') && !token) || (url.searchParams.has('token_hash') && !tokenHash)) return null;
  if ((token && tokenHash) || (!token && !tokenHash)) return null;

  const type = url.searchParams.get('type');
  if (!allowedType(type)) return null;

  const normalizedToken = (tokenHash || token || '').trim();
  if (!normalizedToken) return null;
  return { kind: 'link', token_hash: normalizedToken, type };
}

/**
 * Analisa um link original copiado do e-mail ou um código de 6–8 dígitos.
 * URLs arbitrárias, localhost callbacks e implicit-flow access_token são rejeitados.
 */
export function parseCredential(value: string, mode: EditorCredentialMode = 'auto'): EditorCredential | null {
  const normalized = value.trim();
  if (!normalized) return null;

  if (mode !== 'link' && CODE_PATTERN.test(normalized)) {
    return { kind: 'code', token: normalized, type: 'email' };
  }
  if (mode === 'code') return null;
  if (mode === 'link' || mode === 'auto') return parseVerificationLink(normalized);
  return null;
}

/** Alias explícito para consumidores que preferem o nome com domínio. */
export const parseEditorCredential = parseCredential;

/**
 * Converte o resultado validado em um payload mínimo para `auth.verifyOtp`.
 * O e-mail só é necessário para códigos; links token-hash não recebem e-mail.
 */
export function toVerifyOtpParams(credential: EditorCredential, email = ''): EditorVerifyOtpParams {
  if (credential.kind === 'link') {
    return { token_hash: credential.token_hash, type: credential.type };
  }

  const normalizedEmail = email.trim();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error('Informe o mesmo e-mail autorizado usado para solicitar o código.');
  }
  return { email: normalizedEmail, token: credential.token, type: 'email' };
}

/**
 * Extrai somente o erro de autenticação do hash/query da URL atual.
 * O valor retornado nunca contém token, URL ou descrição bruta do provedor.
 */
export function parseAuthErrorFromHref(href: string): EditorAuthUrlError | null {
  try {
    const url = new URL(href);
    const search = url.searchParams;
    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const code = hash.get('error_code') || search.get('error_code') || hash.get('error') || search.get('error');
    if (!code) return null;
    return { code: code.trim().toLowerCase(), error: hash.get('error_description') || search.get('error_description') || undefined };
  } catch {
    return null;
  }
}

/**
 * Reduz erros do Auth a mensagens acionáveis, sem mostrar credenciais ou URLs.
 */
export function friendlyEditorAuthError(error: unknown): string {
  const source = typeof error === 'object' && error !== null ? (error as { code?: unknown; error_code?: unknown; message?: unknown }) : {};
  const code = String(source.code || source.error_code || '').trim().toLowerCase();
  const message = String(source.message || error || '').trim().toLowerCase();

  if (EXPIRED_CODES.has(code) || /otp_expired|token.*expired|expired/.test(message)) {
    return 'Este link expirou ou já foi usado. Solicite um novo link e use somente o mais recente.';
  }
  if (USED_CODES.has(code) || /already.*used|invalid.*token|token.*not.*found/.test(message)) {
    return 'Este link já foi usado ou não é mais válido. Solicite um novo link e use somente o mais recente.';
  }
  if (code === 'over_request_rate_limit' || /rate limit|too many requests|too many/.test(message)) {
    return 'Aguarde um pouco antes de solicitar outro link. Use somente o link mais recente.';
  }
  if (code === 'invalid_credentials' || /invalid.*otp|invalid.*code/.test(message)) {
    return 'O código ou link não é válido. Confira o conteúdo original do e-mail e tente novamente.';
  }
  if (code === 'email_not_confirmed' || /email.*not.*confirmed/.test(message)) {
    return 'Confirme o acesso usando o link original recebido por e-mail.';
  }
  return 'Não foi possível confirmar o acesso. Cole o link original ou um código de 6 a 8 dígitos e tente novamente.';
}

/** Alias curto para integrações de tela. */
export const friendlyAuthError = friendlyEditorAuthError;

/**
 * Gera o destino do e-mail sem hash, para que o Auth não substitua o fragmento.
 * Recebe a origem explicitamente para continuar puro e fácil de testar.
 */
export function getEditorLoginRedirect(origin: string): string {
  return new URL('/?editor_login=1', origin).toString();
}

/** Alias de integração para o callback do app. */
export const getRedirect = getEditorLoginRedirect;
