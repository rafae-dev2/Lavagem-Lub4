import EquipmentThumbnail from './EquipmentThumbnail';
import { cleanScheduleObservation, effectiveScheduleCompletionDate } from '../lib/schedulePresentation';
import { Edit2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { getCardTiltProps } from '../hooks/useCardTilt';
import { Programacao, StatusType } from '../types';
import { Play, Check, CalendarClock, RotateCcw, Loader2, GripVertical } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  schedules: Programacao[];
  isDark: boolean;
  quickUpdating: string | null;
  onQuick: (s: Programacao, status: StatusType) => void;
  onPostpone: (s: Programacao) => void;
  onOpenFrota?: (frota: string) => void;
  onEdit?: (schedule: Programacao) => void;
}

interface ColumnDef {
  key: StatusType;
  label: string;
  dot: string;
  ring: string;      // cor de destaque no drag-over
  headBg: string;    // fundo do cabeçalho
}

const COLUMNS: ColumnDef[] = [
  { key: 'ATRASADO',   label: 'Atrasado',   dot: 'bg-red-500',    ring: 'border-red-400/70 bg-red-500/10',       headBg: 'text-red-400' },
  { key: 'PENDENTE',   label: 'Pendente',   dot: 'bg-amber-400',  ring: 'border-amber-400/70 bg-amber-400/10',   headBg: 'text-amber-400' },
  { key: 'PROGRAMADO', label: 'Programado', dot: 'bg-blue-500',   ring: 'border-blue-400/70 bg-blue-500/10',     headBg: 'text-blue-400' },
  { key: 'ANDAMENTO',  label: 'Andamento',  dot: 'bg-purple-500', ring: 'border-purple-400/70 bg-purple-500/10', headBg: 'text-purple-400' },
  { key: 'ENCERRADO',  label: 'Encerrado',  dot: 'bg-green-500',  ring: 'border-green-400/70 bg-green-500/10',    headBg: 'text-green-400' },
];

function fmtDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, 'dd/MM', { locale: ptBR }) : iso;
  } catch { return iso; }
}

export const TurnoKanban: React.FC<Props> = ({ schedules, isDark, quickUpdating, onQuick, onPostpone, onOpenFrota, onEdit }) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StatusType | null>(null);
  const kanbanTiltProps = getCardTiltProps<HTMLDivElement>({ maxTiltDeg: 5, scale: 1.015 });

  const grouped = useMemo(() => {
    const map: Record<string, Programacao[]> = {
      ATRASADO: [], PENDENTE: [], PROGRAMADO: [], ANDAMENTO: [], ENCERRADO: [],
    };
    schedules.forEach((s) => {
      if (map[s.situacao]) map[s.situacao]!.push(s);
    });
    return map;
  }, [schedules]);

  const handleDrop = (col: StatusType) => {
    const id = draggingId;
    setOverCol(null);
    setDraggingId(null);
    if (!id) return;
    const item = schedules.find((s) => s.id === id);
    if (!item || item.situacao === col) return;
    onQuick(item, col);
  };

  const cardBase = isDark
    ? 'bg-[var(--bg-tertiary)] border border-white/10 hover:border-[var(--brand-green)]/40'
    : 'bg-white border border-gray-200 hover:border-green-400';

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
      {COLUMNS.map((col) => {
        const items = grouped[col.key] || [];
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOverCol(null); }}
            onDrop={() => handleDrop(col.key)}
            className={`snap-start shrink-0 w-[240px] sm:w-[260px] rounded-2xl flex flex-col transition-colors duration-150 ${
              isDark ? 'glass-card' : 'bg-gray-50 border border-gray-200'
            } ${isOver ? `ring-2 ${col.ring}` : ''}`}
          >
            {/* Cabeçalho da coluna */}
            <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${col.dot} ${col.key === 'ATRASADO' || col.key === 'ANDAMENTO' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-bold uppercase tracking-wide ${col.headBg}`}>{col.label}</span>
              <span className={`ml-auto text-xs font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-[var(--text-secondary)]' : 'bg-gray-200 text-gray-700'}`}>
                {items.length}
              </span>
            </div>

            {/* Corpo (drop zone) */}
            <div className="p-2 space-y-2 min-h-[120px] max-h-[62vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className={`flex items-center justify-center h-24 rounded-xl border border-dashed text-[11px] ${
                  isDark ? 'border-white/10 text-[var(--text-muted)]' : 'border-gray-300 text-gray-400'
                }`}>
                  Arraste cartões aqui
                </div>
              ) : items.map((s) => {
                const busy = quickUpdating === s.id;
                return (
                  <div
                    key={s.id}
                    draggable={s.origemRegistro !== 'PCM'}
                    {...kanbanTiltProps}
                    onDragStart={(e) => {
                      kanbanTiltProps.onDragStart(e);
                      setDraggingId(s.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                    className={`glass-card tilt-card group rounded-xl p-2.5 cursor-grab active:cursor-grabbing shadow-sm transition-all duration-150 ${cardBase} ${
                      draggingId === s.id ? 'is-active opacity-50 scale-[0.98]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <EquipmentThumbnail equipment={s} size="table" /><GripVertical size={13} className={isDark ? 'text-[var(--text-muted)]' : 'text-gray-300'} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenFrota?.(s.frota); }}
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg font-black text-[11px] text-white bg-gradient-to-b from-green-500 to-green-700 border border-green-400/40 shadow-[0_2px_6px_rgba(22,163,74,0.4)] transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                        title={`Ver histórico da frota ${s.frota}`}
                      >
                        {s.frota}
                      </button>
                      {s.horarioAgendado && (
                        <span className={`ml-auto text-[11px] font-semibold ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>
                          {s.horarioAgendado}
                        </span>
                      )}
                    </div>

                    <div className={`mt-1.5 text-[11px] leading-snug ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
                      <span className="font-medium">{s.descricaoPonto}</span>
                      {s.dataProgramada && <span className="opacity-70"> · {fmtDate(s.dataProgramada)}</span>}
                    </div>

                    {cleanScheduleObservation(s) && (
                      <div
                        className={`mt-1.5 text-[10px] px-1.5 py-1 rounded-md border truncate ${
                          isDark
                            ? 'bg-amber-500/15 text-amber-200 border-amber-400/35'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                        title={cleanScheduleObservation(s)}
                      >
                        {cleanScheduleObservation(s)}
                      </div>
                    )}

                    {s.situacao === 'ENCERRADO' && effectiveScheduleCompletionDate(s) && (
                      <p className={`mt-2 text-[11px] font-medium ${isDark ? 'text-emerald-300' : 'text-green-700'}`}>
                        Realizada em {fmtDate(effectiveScheduleCompletionDate(s))}
                      </p>
                    )}
                    {/* Ações rápidas no cartão */}
                    <div className={`mt-2 flex items-center gap-1 pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                      {onEdit && <button type="button" onClick={() => onEdit(s)} className="lub-edit" aria-label={`Editar programação da frota ${s.frota}`}><Edit2 size={12} />Editar</button>}
                      {busy && <Loader2 size={13} className="animate-spin text-[var(--brand-green)]" />}
                      {!busy && s.origemRegistro !== 'PCM' && s.situacao !== 'ANDAMENTO' && s.situacao !== 'ENCERRADO' && (
                        <button
                          onClick={() => onQuick(s, 'ANDAMENTO')}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md transition-colors ${isDark ? 'text-purple-300 hover:bg-purple-500/15' : 'text-purple-600 hover:bg-purple-50'}`}
                          title="Iniciar"
                        >
                          <Play size={11} /> Iniciar
                        </button>
                      )}
                      {!busy && s.origemRegistro !== 'PCM' && s.situacao !== 'ENCERRADO' && (
                        <button
                          onClick={() => onQuick(s, 'ENCERRADO')}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md transition-colors ${isDark ? 'text-green-300 hover:bg-green-500/15' : 'text-green-600 hover:bg-green-50'}`}
                          title="Concluir"
                        >
                          <Check size={11} /> Concluir
                        </button>
                      )}
                      {!busy && s.origemRegistro !== 'PCM' && s.situacao !== 'ENCERRADO' && (
                        <button
                          onClick={() => onPostpone(s)}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md transition-colors ${isDark ? 'text-amber-300 hover:bg-amber-500/15' : 'text-amber-600 hover:bg-amber-50'}`}
                          title="Adiar 1 dia"
                        >
                          <CalendarClock size={11} /> Adiar
                        </button>
                      )}
                      {!busy && s.origemRegistro !== 'PCM' && s.situacao === 'ENCERRADO' && (
                        <button
                          onClick={() => onQuick(s, 'PROGRAMADO')}
                          className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-1 rounded-md transition-colors ${isDark ? 'text-blue-300 hover:bg-blue-500/15' : 'text-blue-600 hover:bg-blue-50'}`}
                          title="Reabrir"
                        >
                          <RotateCcw size={11} /> Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TurnoKanban;
