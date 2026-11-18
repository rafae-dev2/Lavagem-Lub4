import { cleanScheduleObservation, effectiveScheduleCompletionDate } from '../lib/schedulePresentation';
import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Programacao } from '../types';
import StatusBadge from './StatusBadge';
import { X, Droplets, CalendarClock, History, CheckCircle2, ClipboardList } from 'lucide-react';
import { parseISO, isValid, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  frota: string | null;
  schedules: Programacao[];   // histórico COMPLETO (não filtrado)
  isDark: boolean;
  onClose: () => void;
}

function refIso(s: Programacao): string {
  return effectiveScheduleCompletionDate(s) || s.dataProgramada || '';
}

function toDate(iso: string): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

function fmt(iso: string): string {
  const d = toDate(iso);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : '—';
}

/** Cor conforme dias desde a última lavagem/lubrificação. */
function sevByDays(days: number | null, isDark: boolean) {
  if (days === null) return { txt: isDark ? 'text-red-400' : 'text-red-600', chip: isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200' };
  if (days >= 15) return { txt: isDark ? 'text-red-400' : 'text-red-600', chip: isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200' };
  if (days >= 7) return { txt: isDark ? 'text-amber-400' : 'text-amber-600', chip: isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200' };
  return { txt: isDark ? 'text-green-400' : 'text-green-600', chip: isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200' };
}

export const HistoricoFrotaModal: React.FC<Props> = ({ frota, schedules, isDark, onClose }) => {
  // Fechar com a tecla Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = useMemo(() => {
    if (!frota) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetFrota = frota.trim();
    const records = schedules
      .filter((s) => (s.frota || '').trim() === targetFrota)
      .slice()
      .sort((a, b) => refIso(b).localeCompare(refIso(a)));

    const concluidas = records.filter((s) => s.situacao === 'ENCERRADO');
    const abertas = records.filter((s) => s.situacao !== 'ENCERRADO');

    // Última concluída (geral)
    let ultima: { iso: string; days: number | null } = { iso: '', days: null };
    const concluidasComData = concluidas.filter((s) => refIso(s));
    if (concluidasComData.length) {
      const iso = concluidasComData
        .map(refIso)
        .sort((a, b) => b.localeCompare(a))[0]!;
      const d = toDate(iso);
      ultima = { iso, days: d ? differenceInDays(today, d) : null };
    }

    // Última concluída por TIPO (ex.: Lavagem / Lubrificação, Lubrificação, Troca de Óleo)
    const porTipoMap: Record<string, string> = {};
    concluidasComData.forEach((s) => {
      const tipo = (s.tipoPreventiva || 'Serviço').trim();
      const iso = refIso(s);
      if (!porTipoMap[tipo] || iso.localeCompare(porTipoMap[tipo]!) > 0) {
        porTipoMap[tipo] = iso;
      }
    });
    const porTipo = Object.entries(porTipoMap)
      .map(([tipo, iso]) => {
        const d = toDate(iso);
        return { tipo, iso, days: d ? differenceInDays(today, d) : null };
      })
      .sort((a, b) => (b.iso).localeCompare(a.iso));

    return { records, concluidas, abertas, ultima, porTipo };
  }, [frota, schedules]);

  if (!frota || !data) return null;

  const sev = sevByDays(data.ultima.days, isDark);
  const cardCls = isDark ? 'glass-card' : 'bg-white';

  const modal = (
    <div
      className="lub-module historico-frota-modal fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="historico-frota-title"
      onClick={onClose}
    >
      <div
        className={`historico-frota-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${cardCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 p-5 border-b ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
          <div className={`p-2 rounded-xl ${isDark ? 'bg-[var(--brand-green)]/15' : 'bg-green-50'}`}>
            <History size={18} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
          </div>
          <div className="flex items-center gap-2">
            <h3 id="historico-frota-title" className={`text-base font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>Histórico da Frota</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-black text-xs text-white bg-gradient-to-b from-green-500 to-green-700 border border-green-400/40 shadow-[0_2px_8px_rgba(22,163,74,0.45)]">
              {frota}
            </span>
          </div>
          <button
            type="button"
            aria-label="Fechar histórico da frota"
            onClick={onClose}
            className={`ml-auto p-1 rounded-lg ${isDark ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Destaque: última lavagem/lubrificação + dias */}
          <div className={`rounded-xl border p-4 ${sev.chip}`}>
            <div className="flex items-center gap-2 mb-1">
              <Droplets size={15} className={sev.txt} />
              <span className={`text-xs font-bold uppercase tracking-wide ${sev.txt}`}>Última lavagem / lubrificação</span>
            </div>
            {data.ultima.iso ? (
              <div className="flex items-end gap-3 flex-wrap">
                <span className={`text-2xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{fmt(data.ultima.iso)}</span>
                <span className={`text-sm font-bold mb-0.5 ${sev.txt}`}>
                  {data.ultima.days === 0 ? 'hoje' : data.ultima.days === 1 ? 'há 1 dia' : `há ${data.ultima.days} dias`}
                </span>
              </div>
            ) : (
              <span className={`text-lg font-bold ${sev.txt}`}>Sem lavagem registrada</span>
            )}
          </div>

          {/* Cards: concluídas / em aberto / último por tipo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={13} className={isDark ? 'text-green-400' : 'text-green-600'} />
                <span className={`text-[11px] font-semibold ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Concluídas</span>
              </div>
              <span className={`text-xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{data.concluidas.length}</span>
            </div>
            <div className={`rounded-xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <ClipboardList size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                <span className={`text-[11px] font-semibold ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Em aberto</span>
              </div>
              <span className={`text-xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{data.abertas.length}</span>
            </div>
            <div className={`rounded-xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <History size={13} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
                <span className={`text-[11px] font-semibold ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Registros</span>
              </div>
              <span className={`text-xl font-black ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{data.records.length}</span>
            </div>
          </div>

          {/* Último de cada tipo */}
          {data.porTipo.length > 0 && (
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Última vez por tipo</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.porTipo.map((t) => {
                  const s = sevByDays(t.days, isDark);
                  return (
                    <div key={t.tipo} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
                      <span className={`text-xs font-semibold truncate ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700'}`}>{t.tipo}</span>
                      <span className="text-right flex-shrink-0">
                        <span className={`block text-xs font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{fmt(t.iso)}</span>
                        <span className={`block text-[10px] font-semibold ${s.txt}`}>
                          {t.days === 0 ? 'hoje' : t.days === 1 ? 'há 1 dia' : `há ${t.days} dias`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linha do tempo */}
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
              <CalendarClock size={13} /> Linha do tempo ({data.records.length})
            </h4>
            {data.records.length === 0 ? (
              <p className={`text-sm text-center py-6 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>Nenhum registro para esta frota.</p>
            ) : (
              <div className="space-y-2">
                {data.records.map((s) => (
                  <div key={s.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-100 bg-white'}`}>
                    <div className="flex-shrink-0">
                      <StatusBadge status={s.situacao} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-semibold ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700'}`}>
                        {s.tipoPreventiva}
                        <span className={`ml-2 font-normal ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>· {s.descricaoPonto}</span>
                      </div>
                      {cleanScheduleObservation(s) && (
                        <div className={`text-[11px] truncate ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`} title={cleanScheduleObservation(s)}>{cleanScheduleObservation(s)}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>
                        {s.situacao === 'ENCERRADO' && s.dataRealizada ? fmt(s.dataRealizada) : fmt(s.dataProgramada)}
                      </div>
                      <div className={`text-[10px] ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>
                        {s.situacao === 'ENCERRADO' && s.dataRealizada ? 'realizada' : 'programada'}
                        {s.horarioAgendado ? ` · ${s.horarioAgendado}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};

export default HistoricoFrotaModal;
