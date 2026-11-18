import EquipmentImageManager from '../components/EquipmentImageManager';
import React, { useState } from "react";
import { getStoredConfig, testSupabaseConnection } from "../lib/sheetsService";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  LAVAGEM_TABLE,
} from "../lib/supabaseClient";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Zap,
  RefreshCw,
  Info,
  Truck,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

interface Props {
  onRefresh: () => void;
}

export default function Configuracoes({ onRefresh }: Props) {
  const { isDark } = useTheme();
  const config = getStoredConfig();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const testSupabase = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.ok) onRefresh();
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  // ── Helpers de estilo ────────────────────────────────────────────────────
  const card = isDark
    ? "glass-card"
    : "bg-white border border-gray-200 rounded-xl shadow-sm";
  const label = isDark ? "text-[var(--text-secondary)]" : "text-gray-600";
  const hint = isDark ? "text-[var(--text-muted)]" : "text-gray-400";
  const input = isDark
    ? "glass-input placeholder-[var(--text-muted)] focus:border-[var(--brand-green)] focus:ring-[#00ff88]/20"
    : "bg-white border-gray-300 text-gray-900 focus:ring-green-500";

  const maskedKey =
    SUPABASE_ANON_KEY.substring(0, 24) + "…" + SUPABASE_ANON_KEY.slice(-8);

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <div>
        <h2
          className={`text-xl font-bold ${isDark ? "text-[var(--text-primary)]" : "text-gray-900"}`}
        >
          Configurações
        </h2>
        <p
          className={`text-sm ${isDark ? "text-[var(--text-muted)]" : "text-gray-500"}`}
        >
          Integrações de banco de dados
        </p>
      </div>

      <EquipmentImageManager />
      {/* ═════════════════════════════════════════════════════════════════════════
          SEÇÃO 1: LAVAGEM / LUBRIFICAÇÃO — SUPABASE
          ════════════════════════════════════════════════════════════════════════ */}
      <div
        className={`${isDark ? "glass-card border-[var(--brand-green)]/20" : "bg-white border-2 border-green-200 rounded-xl shadow-sm"} p-5`}
      >
        <h3
          className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-[var(--text-primary)]" : "text-gray-800"}`}
        >
          <Zap
            size={16}
            className={isDark ? "text-[var(--brand-green)]" : "text-green-600"}
          />{" "}
          Supabase — Lavagem e Lubrificação
        </h3>

        <div
          className={`mb-4 text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
            isDark
              ? "bg-[var(--brand-green)]/10 text-[var(--brand-green)] border border-[var(--brand-green)]/25"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          <CheckCircle2 size={14} />
          <span>
            <strong>Conexão direta e rápida.</strong> O app lê e escreve na
            tabela <code>{LAVAGEM_TABLE}</code> do Supabase (sem RLS — uso
            interno).
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className={`text-xs font-medium block mb-1 ${label}`}>
              URL do projeto
            </label>
            <input
              value={SUPABASE_URL}
              readOnly
              className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono transition-colors ${input} opacity-80`}
            />
          </div>

          <div>
            <label className={`text-xs font-medium block mb-1 ${label}`}>
              Tabela
            </label>
            <input
              value={config.spreadsheetId}
              readOnly
              className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono transition-colors ${input} opacity-80`}
            />
          </div>

          <div>
            <label className={`text-xs font-medium block mb-1 ${label}`}>
              ANON KEY (pública)
            </label>
            <input
              value={maskedKey}
              readOnly
              className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none font-mono transition-colors ${input} opacity-80`}
            />
            <p className={`text-xs mt-1 ${hint}`}>
              Chave hardcoded no build. Para trocar, alterar{" "}
              <code>src/lib/supabaseClient.ts</code>.
            </p>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
                testResult.ok
                  ? isDark
                    ? "bg-[var(--brand-green)]/10 text-[var(--brand-green-light)] border border-[var(--brand-green)]/25"
                    : "bg-green-50 text-green-700 border border-green-200"
                  : isDark
                    ? "bg-red-500/10 text-red-400 border border-red-500/25"
                    : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              )}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={testSupabase}
              disabled={testing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
                isDark
                  ? "border border-[var(--brand-green)]/30 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/10"
                  : "border border-green-200 text-green-700 hover:bg-green-50"
              }`}
            >
              {testing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              {testing ? "Testando..." : "Testar Conexão Supabase"}
            </button>
            <button
              onClick={onRefresh}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                isDark
                  ? "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <RefreshCw size={14} /> Recarregar dados
            </button>
          </div>
        </div>
      </div>

      <section className={`${card} p-5`}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Database size={16} /> Integração — Gestão de Ordens Manutenção
        </h3>
        <div className={`space-y-3 text-xs ${label}`}>
          <p>
            Preventivas e Lubrificação das Carretas Canavieiras e Reformas dos
            Equipamentos Apoio utilizam a mesma fotografia de ordens do Controle
            Apoio, no Supabase existente.
          </p>
          <p>
            O carregamento utiliza <code>carregar_apoio_controle</code>; a
            atualização utiliza a função <code>sync-ordens</code> já
            configurada. A interface consulta a integração a cada minuto
            enquanto visível e permite atualização manual.
          </p>
          <p>
            Os grupos e equipamentos próprios usados em Reformas são cadastrados
            no <strong>Controle de Equipamentos — Apoio</strong>. As carretas
            são reconhecidas pelo cadastro compartilhado e pelo mapeamento de
            frotas/descrição canavieira existente.
          </p>
          <p>
            Ordens ausentes da listagem não são confirmação de execução. O
            status original e o critério de seleção ficam visíveis nos detalhes
            e relatórios.
          </p>
          <p>
            Os módulos antigos de Carretas via planilha foram removidos. Seus
            dados externos não foram apagados.
          </p>
        </div>
      </section>

      {/* Como configurar */}
      <div className={`${card} p-5`}>
        <h3
          className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? "text-[var(--text-primary)]" : "text-gray-800"}`}
        >
          <Database
            size={16}
            className={isDark ? "text-[var(--text-muted)]" : "text-gray-500"}
          />{" "}
          Como configurar o Supabase (Lavagem)
        </h3>
        <ol
          className={`space-y-2 text-xs list-decimal list-inside ${isDark ? "text-[var(--text-secondary)]" : "text-gray-600"}`}
        >
          <li>Abra o painel do Supabase → SQL Editor</li>
          <li>
            Rode o arquivo <code>SUPABASE_SETUP.sql</code> (está na pasta raiz
            do projeto)
          </li>
          <li>
            A tabela <code>{LAVAGEM_TABLE}</code> será criada com RLS desativado
          </li>
          <li>O app já está configurado com URL e ANON KEY — basta abrir</li>
        </ol>
        <div
          className={`mt-3 text-xs ${isDark ? "text-amber-400" : "text-amber-700"}`}
        >
          <strong>App interno:</strong> sem segurança extra (RLS desativado).
          Não exponha para público externo.
        </div>
      </div>

      <div
        className={`text-center text-xs pb-4 ${isDark ? "text-[var(--text-muted)]" : "text-gray-400"}`}
      >
        BRANCO PERES — Controle de Manutenção v10.0 — 2026
      </div>
    </div>
  );
}
