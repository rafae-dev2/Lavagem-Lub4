import React, { useMemo, useState } from 'react';
import { Programacao } from '../types';
import { AlertTriangle, Droplets, ShieldCheck, Clock, ChevronDown } from 'lucide-react';
import { parseISO, isValid, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import HistoricoFrotaModal from './HistoricoFrotaModal';
import { getCardTiltProps } from '../hooks/useCardTilt';

interface Props {
  schedules: Programacao[];
  isDark: boolean;
}

const STORAGE_KEY = 'bp_alerta_dias';
const THRESHOLD_OPTIONS = [7, 10, 15, 30];

interface FrotaInfo {
  frota: string;
  lastWash: Date | null;
  lastWashIso: string;
  days: number | null;      // dias desde a última lavagem (null = nunca)
  pendentes: number;
}

function loadThreshold(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    if (THRESHOLD_OPTIONS.includes(v)) return v;
  } catch { /* ignore */ }
  return 15;
}

export const AlertasEquipamentos: React.FC<Props> = ({ schedules, isDark }) => {
  const [threshold, setThreshold] = useState<number>(() => loadThreshold());
  const [historicoFrota, setHistoricoFrota] = useState<string | null>(null);
  const alertTiltProps = getCardTiltProps<HTMLButtonElement>({ maxTiltDeg: 5.5, scale: 1.015 });

  const changeThreshold = (v: number) => {
    setThreshold(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* ignore */ }
  };

  const { alertas, emDia } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const byFrota: Record<string, FrotaInfo> = {};

    schedules.forEach((s) => {
      const frota = (s.frota || '').trim();
      if (!frota) return;
      if (!byFrota[frota]) {
        byFrota[frota] = { frota, lastWash: null, lastWashIso: '', days: null, pendentes: 0 };
      }
      const info = byFrota[frota]!;

      if (s.situacao !== 'ENCERRADO') {
        info.pendentes += 1;
        return;
      }
      const iso = s.dataRealizada || s.dataProgramada;
      if (!iso) return;
      const d = parseISO(iso);
      if (!isValid(d)) return;
      if (!info.lastWash || d > info.lastWash) {
        info.lastWash = d;
        info.lastWashIso = iso;
      }
    });

    const all = Object.values(byFrota).map((info) => {
      const days = info.lastWash ? differenceInDays(today, info.lastWash) : null;
      return { ...info, days };
    });

    // Alertas: sem registro de lavagem OU dias >= threshold
    const alertas = all
      .filter((f) => f.days === null || (f.days as number) >= threshold)
      .sort((a, b) => {
        if (a.days === null) return -1;
        if (b.days === null) return 1;
        return (b.days as number) - (a.days as number);
      });

    const emDia = all.length - alertas.length;
    return { alertas, emDia };
  }, [schedules, threshold]);

  const cardCls = isDark ? 'glass-card' : 'glass-card bg-white rounded-xl border border-gray-200 shadow-md';

  return (
    <>
    <div className={`${cardCls} p-4 flex flex-col h-full`}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-3">
        <Droplets size={16} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
        <h3 className={`text-sm font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-800'}`}>
          Equipamentos sem lavagem
        </h3>
        {alertas.length > 0 && (
          <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30">
            {alertas.length}
          </span>
        )}

        {/* Seletor de dias */}
        <div className="ml-auto relative">
          <div className={`flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs font-semibold ${
            isDark ? 'bg-[var(--bg-tertiary)] border border-white/10 text-[var(--text-secondary)]' : 'bg-gray-100 text-gray-600'
          }`}>
            <Clock size={12} className="opacity-70" />
            <span className="hidden sm:inline">há mais de</span>
            <div className="relative flex items-center">
              <select
                value={threshold}
                onChange={(e) => changeThreshold(Number(e.target.value))}
                className={`appearance-none bg-transparent pr-4 font-bold focus:outline-none cursor-pointer ${isDark ? 'text-[var(--brand-green)]' : 'text-green-700'}`}
              >
                {THRESHOLD_OPTIONS.map((o) => (
                  <option key={o} value={o} className="text-gray-900">{o}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-0 pointer-events-none opacity-60" />
            </div>
            <span>dias</span>
          </div>
        </div>
      </div>

      {/* Lista */}
      {alertas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${isDark ? 'bg-green-500/15' : 'bg-green-50'}`}>
            <ShieldCheck size={22} className={isDark ? 'text-green-400' : 'text-green-600'} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700'}`}>Tudo em dia!</p>
          <p className={`text-xs ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>
            Nenhum equipamento parado há mais de {threshold} dias
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-[280px] pr-1">
          {alertas.map((f) => {
            const never = f.days === null;
            const critical = !never && (f.days as number) >= threshold * 2;
            const sev = never || critical
              ? { txt: isDark ? 'text-red-400' : 'text-red-600', bg: isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200', dot: 'bg-red-500' }
              : { txt: isDark ? 'text-amber-400' : 'text-amber-600', bg: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' };
            const isSelected = historicoFrota === f.frota;
            return (
              <button
                key={f.frota}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setHistoricoFrota(f.frota)}
                {...alertTiltProps}
                className={`glass-card dashboard-equipment-card tilt-card w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all hover:brightness-110 cursor-pointer ${sev.bg} ${isSelected ? 'is-selected' : ''}`}
                title={`Ver histórico da frota ${f.frota}`}
              >
                <span className={`w-2 h-2 rounded-full ${sev.dot} ${critical || never ? 'animate-pulse' : ''} flex-shrink-0`} />
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-black text-[11px] text-white bg-gradient-to-b from-green-500 to-green-700 border border-green-400/40 flex-shrink-0">
                  {f.frota}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold ${sev.txt}`}>
                    {never ? 'Sem lavagem registrada' : `${f.days} dias sem lavar`}
                  </div>
                  <div className={`text-[10px] ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>
                    {f.lastWash
                      ? `Última: ${format(f.lastWash, "dd/MM/yyyy", { locale: ptBR })}`
                      : (f.pendentes > 0 ? `${f.pendentes} programação(ões) em aberto` : 'sem histórico')}
                  </div>
                </div>
                {(critical || never) && (
                  <AlertTriangle size={14} className={isDark ? 'text-red-400' : 'text-red-500'} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Rodapé */}
      <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] ${isDark ? 'border-white/5 text-[var(--text-muted)]' : 'border-gray-100 text-gray-400'}`}>
        <span className="flex items-center gap-1">
          <ShieldCheck size={12} className={isDark ? 'text-green-400' : 'text-green-600'} /> {emDia} em dia
        </span>
        <span>Meta: lavar a cada {threshold} dias</span>
      </div>
    </div>

    {historicoFrota && (
      <HistoricoFrotaModal
        frota={historicoFrota}
        schedules={schedules}
        isDark={isDark}
        onClose={() => setHistoricoFrota(null)}
      />
    )}
    </>
  );
};

export default AlertasEquipamentos;
