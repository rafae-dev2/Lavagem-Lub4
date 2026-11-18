import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Search, X } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Programacao } from '../types';
import { fetchPcmHistory, registerPcmExecution } from '../lib/pcmHistoryService';
import { sortSchedules } from '../lib/scheduleOrder';
import { effectiveScheduleCompletionDate } from '../lib/schedulePresentation';
import { filterLavagemEquipmentSchedules } from '../lib/lavagemEquipmentScope';

interface Props {
  isDark: boolean;
  hideMainEquipment?: boolean;
  focusId?: string | null;
  onClose: () => void;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'dd/MM/yyyy', { locale: ptBR }) : value;
}

function formatBrasiliaTimestamp(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

function isValidExecutionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

function text(value?: string): string {
  return String(value || '').trim();
}

export default function PCMHistoryPanel({ isDark, focusId, onClose, hideMainEquipment = false }: Props) {
  const [history, setHistory] = useState<Programacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterFrota, setFilterFrota] = useState('TODOS');
  const [filterOS, setFilterOS] = useState('TODOS');
  const [filterGrupo, setFilterGrupo] = useState('TODOS');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [executionDate, setExecutionDate] = useState('');
  const [executionObservation, setExecutionObservation] = useState('');
  const appliedFocusRef = useRef<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPcmHistory();
      setHistory(sortSchedules(hideMainEquipment ? filterLavagemEquipmentSchedules(rows) : rows));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico PCM.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    if (!focusId || history.length === 0 || appliedFocusRef.current === focusId) return;
    const focused = history.find((item) => item.id === focusId || item.pcmChave === focusId);
    if (focused && focused.situacao === 'ENCERRADO' && !focused.manualArquivadoEm) {
      appliedFocusRef.current = focusId;
      setRegisteringId(focused.id);
    }
  }, [focusId, history]);

  const options = useMemo(() => ({
    frotas: [...new Set(history.map((item) => text(item.frota)).filter(Boolean))].sort(),
    os: [...new Set(history.map((item) => text(item.numeroOS)).filter(Boolean))].sort(),
    grupos: [...new Set(history.map((item) => text(item.apoioNome)).filter(Boolean))].sort(),
    tipos: [...new Set(history.map((item) => text(item.tipoPreventiva)).filter(Boolean))].sort(),
  }), [history]);

  const visibleHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return history.filter((item) => {
      const searchable = [
        item.frota,
        item.numeroOS,
        item.apoioNome,
        item.apoioId,
        item.tipoPreventiva,
        item.descricaoPonto,
        item.observacao,
        item.narrativaPCM,
      ].map(text).join(' ').toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (filterFrota === 'TODOS' || item.frota === filterFrota)
        && (filterOS === 'TODOS' || item.numeroOS === filterOS)
        && (filterGrupo === 'TODOS' || item.apoioNome === filterGrupo)
        && (filterTipo === 'TODOS' || item.tipoPreventiva === filterTipo);
    });
  }, [history, query, filterFrota, filterOS, filterGrupo, filterTipo]);

  const clearRegistration = () => {
    setRegisteringId(null);
    setExecutionDate('');
    setExecutionObservation('');
  };

  const confirmExecution = async (item: Programacao) => {
    if (!isValidExecutionDate(executionDate)) {
      setError('Informe uma data de execução válida antes de confirmar.');
      return;
    }
    if (item.manualArquivadoEm || !item.pcmChave) return;
    setSavingId(item.id);
    setError(null);
    try {
      await registerPcmExecution(item.pcmChave, executionDate, executionObservation);
      clearRegistration();
      await loadHistory();
      try {
        window.dispatchEvent(new CustomEvent('bp:pcm-execution-confirmed'));
      } catch {
        // Ambientes sem CustomEvent não impedem a confirmação no backend.
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a execução PCM.');
    } finally {
      setSavingId(null);
    }
  };

  const panel = isDark ? 'glass-card border border-white/10' : 'bg-white border border-gray-200';
  const muted = isDark ? 'text-[var(--text-muted)]' : 'text-gray-500';
  const input = isDark ? 'glass-input border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900';

  const renderRegistration = (item: Programacao) => {
    if (item.manualArquivadoEm || !item.pcmChave || item.situacao !== 'ENCERRADO') return null;
    if (registeringId !== item.id) {
      return (
        <button
          type="button"
          onClick={() => { setRegisteringId(item.id); setExecutionDate(effectiveScheduleCompletionDate(item)); setExecutionObservation(''); setError(null); }}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          Ajustar data realizada
        </button>
      );
    }
    return (
      <div className={`mt-2 rounded-lg p-2.5 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-green-50 border-green-200'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
          <label className={`text-xs font-semibold ${muted}`}>
            Data de execução
            <input
              type="date"
              value={executionDate}
              onChange={(event) => setExecutionDate(event.target.value)}
              className={`block mt-1 border rounded-lg px-2 py-1.5 text-xs ${input}`}
            />
          </label>
          <label className={`text-xs font-semibold ${muted}`}>
            Observação (opcional)
            <input
              type="text"
              value={executionObservation}
              onChange={(event) => setExecutionObservation(event.target.value)}
              placeholder="Observação da execução"
              className={`block mt-1 w-full border rounded-lg px-2 py-1.5 text-xs ${input}`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => void confirmExecution(item)}
            disabled={savingId === item.id}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {savingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Confirmar data de execução
          </button>
          <button type="button" onClick={clearRegistration} className={`text-xs ${muted} hover:underline`}>Cancelar</button>
        </div>
      </div>
    );
  };

  const renderItem = (item: Programacao, card = false) => (
    <div key={item.id} className={`${card ? 'p-3' : 'p-3'} ${isDark ? 'border-b border-white/5' : 'border-b border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{item.frota || '—'}</span>
            {item.numeroOS && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isDark ? 'text-blue-300 border-blue-400/30' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>OS {item.numeroOS}</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isDark ? 'text-cyan-300 border-cyan-400/30' : 'text-cyan-700 bg-cyan-50 border-cyan-200'}`}>{item.tipoPreventiva}</span>
            {item.manualArquivadoEm && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">Manual arquivado/substituído</span>}
          </div>
          <div className={`mt-1 text-xs ${muted}`}>{item.apoioNome || item.apoioId || 'Grupo não informado'} · {item.descricaoPonto || '—'}</div>
        </div>
        {renderRegistration(item)}
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs ${muted}`}>
        <span><strong>Data programada:</strong> {formatDate(item.dataProgramada)}</span>
        <span><strong>Horário:</strong> {item.horarioAgendado || '—'}</span>
        <span><strong>Encerramento detectado:</strong> {formatBrasiliaTimestamp(item.encerradoDetectadoEm)}</span>
        <span><strong>Data realizada:</strong> {formatDate(effectiveScheduleCompletionDate(item))}</span>
        {item.manualArquivadoEm && <span><strong>Manual arquivado:</strong> {formatBrasiliaTimestamp(item.manualArquivadoEm)}</span>}
      </div>
    </div>
  );

  return (
    <section className={`rounded-xl shadow-sm overflow-hidden ${panel}`} aria-label="Histórico de encerradas PCM">
      <div className={`flex items-center justify-between gap-2 p-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div>
          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Histórico de Encerradas</h3>
          <p className={`text-xs mt-0.5 ${muted}`}>Ordens encerradas e registros arquivados. Data automática pelo dia de saída da Gestão de Ordens; ajustes manuais preservados.</p>
        </div>
        <button type="button" onClick={onClose} className={`p-1.5 rounded-lg ${muted} hover:bg-gray-500/10`} title="Fechar histórico"><X size={17} /></button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${muted}`} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar frota, OS, grupo, tipo..." className={`w-full pl-8 pr-2 py-2 border rounded-lg text-xs ${input}`} />
          </div>
          {([
            { label: 'Frota', value: filterFrota, setter: setFilterFrota, values: options.frotas },
            { label: 'OS', value: filterOS, setter: setFilterOS, values: options.os },
            { label: 'Grupo', value: filterGrupo, setter: setFilterGrupo, values: options.grupos },
            { label: 'Tipo', value: filterTipo, setter: setFilterTipo, values: options.tipos },
          ] as Array<{ label: string; value: string; setter: React.Dispatch<React.SetStateAction<string>>; values: string[] }>).map(({ label, value, setter, values }) => (
            <select key={label} value={value} onChange={(event) => setter(event.target.value)} className={`border rounded-lg px-2 py-2 text-xs ${input}`}>
              <option value="TODOS">{label}: Todos</option>
              {values.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ))}
        </div>

        {error && <div className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${isDark ? 'bg-red-950/30 text-red-300 border border-red-800/40' : 'bg-red-50 text-red-700 border border-red-200'}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</div>}
        {loading ? (
          <div className={`flex items-center justify-center gap-2 py-10 text-sm ${muted}`}><Loader2 size={17} className="animate-spin" /> Carregando histórico...</div>
        ) : visibleHistory.length === 0 ? (
          <div className={`py-10 text-center text-sm ${muted}`}><Clock3 size={18} className="mx-auto mb-2 opacity-60" />Nenhuma encerrada encontrada.</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200/20">
              <table className="w-full text-xs">
                <thead className={isDark ? 'bg-white/5 text-[var(--text-muted)]' : 'bg-gray-50 text-gray-600'}>
                  <tr><th className="text-left p-2">Frota / OS</th><th className="text-left p-2">Grupo / Tipo</th><th className="text-left p-2">Data programada</th><th className="text-left p-2">Encerramento detectado</th><th className="text-left p-2">Data realizada</th><th className="text-right p-2">Ação</th></tr>
                </thead>
                <tbody>{visibleHistory.map((item) => <tr key={item.id} className={isDark ? 'border-t border-white/5' : 'border-t border-gray-100'}>
                  <td className="p-2 align-top"><div className="font-bold">{item.frota}</div><div className={muted}>{item.numeroOS ? `OS ${item.numeroOS}` : 'OS —'}</div>{item.manualArquivadoEm && <span className="inline-block mt-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800">Manual arquivado/substituído</span>}</td>
                  <td className="p-2 align-top"><div>{item.apoioNome || item.apoioId || '—'}</div><div className={muted}>{item.tipoPreventiva}</div></td>
                  <td className="p-2 align-top">{formatDate(item.dataProgramada)}{item.horarioAgendado ? ` · ${item.horarioAgendado}` : ''}</td>
                  <td className="p-2 align-top">{formatBrasiliaTimestamp(item.encerradoDetectadoEm)}</td>
                  <td className="p-2 align-top">{formatDate(effectiveScheduleCompletionDate(item))}</td>
                  <td className="p-2 align-top text-right">{renderRegistration(item)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="md:hidden rounded-lg border border-gray-200/20 overflow-hidden">{visibleHistory.map((item) => renderItem(item, true))}</div>
          </>
        )}
      </div>
    </section>
  );
}
