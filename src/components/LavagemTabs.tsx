import React from 'react';
import { List, LayoutDashboard, Upload, Download } from 'lucide-react';
import { PageType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  current: PageType;
  onNavigate: (p: PageType) => void;
  alertCount?: number;
}

const TABS: { id: PageType; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'programacoes', label: 'Programações', icon: List },
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'importar',     label: 'Importar',     icon: Upload },
  { id: 'exportar',     label: 'Exportar',     icon: Download },
];

/**
 * Barra de sub-navegação da seção "Lavagem / Lubrificação".
 * Concentra Programações, Dashboard, Importar e Exportar em um único lugar,
 * conforme solicitado — em vez de itens separados na barra lateral.
 */
export const LavagemTabs: React.FC<Props> = ({ current, onNavigate, alertCount = 0 }) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`lavagem-premium-tabs mb-4 flex items-center gap-1 p-1 rounded-2xl overflow-x-auto ${
        isDark ? 'bg-[var(--bg-tertiary)] border border-white/10' : 'bg-gray-100 border border-gray-200'
      }`}
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = current === t.id;
        return (
          <button
            key={t.id}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              active
                ? isDark
                  ? 'bg-[var(--brand-green)] text-black shadow-md'
                  : 'bg-white text-green-700 shadow-sm'
                : isDark
                  ? 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
            }`}
          >
            <Icon size={16} />
            <span>{t.label}</span>
            {t.id === 'programacoes' && alertCount > 0 && !active && (
              <span className="ml-1 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold bg-red-500">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LavagemTabs;
