import EquipmentThumbnail from '../components/EquipmentThumbnail';
import { useState, useMemo } from 'react';
import { Programacao, StatusType } from '../types';
import StatusBadge from '../components/StatusBadge';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO, isValid, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  schedules: Programacao[];
}

const STATUS_DOT: Record<StatusType, string> = {
  PENDENTE:   'bg-amber-400',
  ATRASADO:   'bg-red-500',
  PROGRAMADO: 'bg-blue-500',
  ANDAMENTO:  'bg-purple-500',
  ENCERRADO:  'bg-green-500',
};

const STATUS_PILL: Record<StatusType, string> = {
  ATRASADO:   'bg-red-500 text-white',
  ENCERRADO:  'bg-green-600 text-white',
  PROGRAMADO: 'bg-blue-500 text-white',
  PENDENTE:   'bg-amber-500 text-white',
  ANDAMENTO:  'bg-purple-500 text-white',
};

export default function Calendario({ schedules }: Props) {
  const { isDark } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Mapa data -> programações
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, Programacao[]>();
    schedules.forEach(s => {
      if (!s.dataProgramada) return;
      try {
        const d = parseISO(s.dataProgramada);
        if (!isValid(d)) return;
        const key = format(d, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
      } catch { /* ignore */ }
    });
    return map;
  }, [schedules]);

  // Gerar dias do calendário (6 semanas)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    return days;
  }, [currentMonth]);

  const selectedSchedules = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return schedulesByDate.get(key) || [];
  }, [selectedDay, schedulesByDate]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // ── CSS helpers ──────────────────────────────────────────────────────────────
  const text       = isDark ? 'text-[var(--text-primary)]' : 'text-gray-900';
  const textMuted  = isDark ? 'text-[var(--text-muted)]' : 'text-gray-500';
  const textSm     = isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700';
  const card       = isDark ? 'glass-card' : 'bg-white border border-gray-200';
  const divider    = isDark ? 'border-white/10' : 'border-gray-100';
  const headerBg   = isDark ? 'bg-[var(--bg-tertiary)]' : 'bg-gray-50';
  const navBtn     = isDark
    ? 'p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)]'
    : 'p-1.5 hover:bg-gray-200 rounded-lg transition-colors';

  // Resumo do mês
  const monthStats = useMemo(() => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM');
    let total = 0, enc = 0, atr = 0, and = 0;
    schedules.forEach(s => {
      if (s.dataProgramada?.startsWith(monthStart)) {
        total++;
        if (s.situacao === 'ENCERRADO') enc++;
        if (s.situacao === 'ATRASADO') atr++;
        if (s.situacao === 'ANDAMENTO') and++;
      }
    });
    return { total, enc, atr, and };
  }, [schedules, currentMonth]);

  return (
    <div className="space-y-4 fade-in">
      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${text}`}>Calendário</h2>
          <p className={`text-sm ${textMuted}`}>Visualização mensal das programações de manutenção</p>
        </div>
        {/* Resumo do mês */}
        {monthStats.total > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
            <span className={`px-2.5 py-1 rounded-lg font-semibold border ${isDark ? 'bg-white/5 border-white/10 text-[var(--text-primary)]' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
              {monthStats.total} total
            </span>
            {monthStats.enc > 0 && (
              <span className={`px-2.5 py-1 rounded-lg font-semibold border ${isDark ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200' : 'bg-green-100 border-green-200 text-green-700'}`}>
                {monthStats.enc} encerradas
              </span>
            )}
            {monthStats.atr > 0 && (
              <span className={`px-2.5 py-1 rounded-lg font-semibold border animate-pulse ${isDark ? 'bg-red-500/15 border-red-400/40 text-red-200' : 'bg-red-100 border-red-200 text-red-700'}`}>
                {monthStats.atr} atrasadas
              </span>
            )}
            {monthStats.and > 0 && (
              <span className={`px-2.5 py-1 rounded-lg font-semibold border ${isDark ? 'bg-purple-500/15 border-purple-400/35 text-purple-200' : 'bg-purple-100 border-purple-200 text-purple-700'}`}>
                {monthStats.and} andamento
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(['PROGRAMADO', 'PENDENTE', 'ATRASADO', 'ANDAMENTO', 'ENCERRADO'] as StatusType[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className={textMuted}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Calendário */}
      <div className={`${card} rounded-xl shadow-sm overflow-hidden`}>
        {/* Navegação de mês */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${divider} ${headerBg}`}>
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className={navBtn}>
            <ChevronLeft size={18} />
          </button>
          <h3 className={`text-base font-semibold capitalize ${text}`}>
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className={navBtn}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className={`grid grid-cols-7 border-b ${divider}`}>
          {weekDays.map(d => (
            <div
              key={d}
              className={`text-center text-xs font-semibold py-2 ${
                isDark ? 'text-[var(--brand-green)]' : 'text-gray-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate.get(key) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasAtrasado = daySchedules.some(s => s.situacao === 'ATRASADO');
            const hasAndamento = daySchedules.some(s => s.situacao === 'ANDAMENTO');

            let cellBg = '';
            if (isDark) {
              if (isSelected)       cellBg = 'bg-green-900/30 ring-2 ring-inset ring-green-500/60';
              else if (hasAtrasado) cellBg = 'bg-red-900/15';
              else if (hasAndamento) cellBg = 'bg-purple-900/10';
              else if (!isCurrentMonth) cellBg = 'bg-white/[0.02]';
              else                  cellBg = 'hover:bg-white/5';
            } else {
              if (isSelected)       cellBg = 'bg-green-50 ring-2 ring-inset ring-green-400';
              else if (hasAtrasado) cellBg = 'bg-red-50/30';
              else if (hasAndamento) cellBg = 'bg-purple-50/30';
              else if (!isCurrentMonth) cellBg = 'bg-gray-50/50';
              else                  cellBg = 'bg-white hover:bg-green-50/30';
            }

            return (
              <div
                key={i}
                onClick={() => daySchedules.length > 0 ? setSelectedDay(day) : setSelectedDay(null)}
                className={`
                  min-h-[72px] p-1.5 border-b border-r ${divider} cursor-pointer transition-colors
                  ${cellBg}
                `}
              >
                {/* Número do dia */}
                <div className={`
                  text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 tabular-nums
                  ${isToday
                    ? isDark
                      ? 'bg-[var(--brand-green)] text-[var(--text-inverse)] font-bold'
                      : 'bg-green-600 text-white'
                    : isCurrentMonth
                      ? isDark ? 'text-[var(--text-primary)]' : 'text-gray-700'
                      : isDark ? 'text-white/25' : 'text-gray-300'
                  }
                `}>
                  {format(day, 'd')}
                </div>

                {/* Pills de frota */}
                <div className="space-y-0.5">
                  {daySchedules.slice(0, 3).map((s, j) => (
                    <div
                      key={j}
                      className={`text-[10px] truncate px-1 py-0.5 rounded leading-tight font-medium ${STATUS_PILL[s.situacao] || 'bg-gray-400 text-white'}`}
                    >
                      {s.frota}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className={`text-[10px] px-1 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
                      +{daySchedules.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel de detalhe do dia selecionado */}
      {selectedDay && selectedSchedules.length > 0 && (
        <div className={`${card} rounded-xl shadow-sm p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${text}`}>
              {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })} — {selectedSchedules.length} programação(ões)
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className={`transition-colors ${isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {selectedSchedules.map(s => (
              <div
                key={s.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full ${STATUS_DOT[s.situacao] || 'bg-gray-400'}`} />
                  <div>
                    <div className="equipment-inline"><EquipmentThumbnail equipment={s} size="table" /><div className={`text-sm font-semibold ${text}`}>Frota {s.frota}</div></div>
                    <div className={`text-xs ${textMuted}`}>{s.tipoPreventiva} • {s.descricaoPonto}</div>
                    {s.observacao && (
                      <div className={`text-xs mt-0.5 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>
                        {s.observacao}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium mb-1 ${textSm}`}>{s.horarioAgendado || '—'}</div>
                  <StatusBadge status={s.situacao} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
