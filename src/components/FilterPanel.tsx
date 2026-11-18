import React, { useState } from 'react';
import { Calendar, X, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type FilterMode = 'periodo' | 'mes-a-mes';
export type StatusType = 'ATRASADO' | 'PENDENTE' | 'PROGRAMADO' | 'ENCERRADO' | 'ANDAMENTO';

export interface FilterState {
  mode: FilterMode;
  dataInicio: string;
  dataFim: string;
  mesInicio: string;
  mesFim: string;
  statuses: StatusType[];
}

interface Props {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose?: () => void;
}

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const ALL_STATUSES: StatusType[] = ['ATRASADO', 'PENDENTE', 'PROGRAMADO', 'ANDAMENTO', 'ENCERRADO'];

const STATUS_OPTIONS: { value: StatusType; label: string; activeStyle: string; inactiveStyle: string }[] = [
  {
    value: 'ATRASADO',
    label: '🔴 Atrasado',
    activeStyle: 'bg-red-500/20 border-red-500/60 text-red-400',
    inactiveStyle: 'border-white/10 text-gray-600',
  },
  {
    value: 'PENDENTE',
    label: '🟡 Pendente',
    activeStyle: 'bg-amber-500/20 border-amber-500/60 text-amber-400',
    inactiveStyle: 'border-white/10 text-gray-600',
  },
  {
    value: 'PROGRAMADO',
    label: '🔵 Programado',
    activeStyle: 'bg-blue-500/20 border-blue-500/60 text-blue-400',
    inactiveStyle: 'border-white/10 text-gray-600',
  },
  {
    value: 'ANDAMENTO',
    label: '🟣 Andamento',
    activeStyle: 'bg-purple-500/20 border-purple-500/60 text-purple-400',
    inactiveStyle: 'border-white/10 text-gray-600',
  },
  {
    value: 'ENCERRADO',
    label: '🟢 Encerrado',
    activeStyle: 'bg-green-500/20 border-green-500/60 text-green-400',
    inactiveStyle: 'border-white/10 text-gray-600',
  },
];

const STATUS_OPTIONS_LIGHT: { value: StatusType; label: string; activeStyle: string }[] = [
  { value: 'ATRASADO',  label: '🔴 Atrasado',   activeStyle: 'bg-red-100 border-red-400 text-red-700' },
  { value: 'PENDENTE',  label: '🟡 Pendente',   activeStyle: 'bg-amber-100 border-amber-400 text-amber-700' },
  { value: 'PROGRAMADO',label: '🔵 Programado', activeStyle: 'bg-blue-100 border-blue-400 text-blue-700' },
  { value: 'ANDAMENTO', label: '🟣 Andamento',  activeStyle: 'bg-purple-100 border-purple-400 text-purple-700' },
  { value: 'ENCERRADO', label: '🟢 Encerrado',  activeStyle: 'bg-green-100 border-green-400 text-green-700' },
];

export default function FilterPanel({ filters, onFiltersChange, onClose }: Props) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(true);

  const handleModeChange = (mode: FilterMode) => onFiltersChange({ ...filters, mode });
  const handleDateChange = (field: 'dataInicio' | 'dataFim', value: string) => onFiltersChange({ ...filters, [field]: value });
  const handleMonthChange = (field: 'mesInicio' | 'mesFim', value: string) => onFiltersChange({ ...filters, [field]: value });

  const handleStatusToggle = (status: StatusType) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  const allSelected = filters.statuses.length === ALL_STATUSES.length;

  const handleSelectAllStatus = () => {
    onFiltersChange({ ...filters, statuses: allSelected ? [] : [...ALL_STATUSES] });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      mode: 'periodo',
      dataInicio: '',
      dataFim: '',
      mesInicio: '01',
      mesFim: '12',
      statuses: [...ALL_STATUSES],
    });
  };

  const card = isDark
    ? 'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
    : 'bg-white border border-gray-200';

  const inputCls = isDark
    ? 'glass-input placeholder-[var(--text-muted)]'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400';

  const labelCls = isDark ? 'text-[var(--text-secondary)]' : 'text-gray-700';

  return (
    <div className={`${card} rounded-xl p-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 font-semibold cursor-pointer"
        >
          <Filter size={18} style={{ color: 'var(--brand-green)' }} />
          <span className={isDark ? 'text-[var(--text-primary)]' : 'text-gray-800'}>Filtros Avançados</span>
        </button>
        {onClose && (
          <button onClick={onClose} className={isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}>
            <X size={18} />
          </button>
        )}
      </div>

      {!expanded && (
        <div className={`text-xs ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
          {filters.statuses.length > 0 && `${filters.statuses.length} status selecionados`}
          {filters.mode === 'periodo' && filters.dataInicio && ` • ${filters.dataInicio} até ${filters.dataFim}`}
          {filters.mode === 'mes-a-mes' && ` • Mês ${filters.mesInicio} até ${filters.mesFim}`}
        </div>
      )}

      {expanded && (
        <div className="space-y-4">
          {/* Modo de filtro */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${labelCls}`}>Modo de Filtro</label>
            <div className="flex gap-2">
              {(['periodo', 'mes-a-mes'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.mode === mode
                      ? isDark
                        ? 'text-black'
                        : 'bg-green-600 text-white'
                      : isDark
                        ? 'glass-card text-[var(--text-tertiary)]'
                        : 'bg-gray-100 border border-gray-300 text-gray-700'
                  }`}
                  style={filters.mode === mode && isDark ? { background: 'var(--brand-green)', color: 'var(--text-inverse)' } : {}}
                >
                  {mode === 'periodo' ? 'Período (Data)' : 'Mês a Mês'}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção de data/mês */}
          {filters.mode === 'periodo' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${labelCls}`}>Data Início</label>
                <input type="date" value={filters.dataInicio} onChange={e => handleDateChange('dataInicio', e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${labelCls}`}>Data Fim</label>
                <input type="date" value={filters.dataFim} onChange={e => handleDateChange('dataFim', e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputCls}`} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${labelCls}`}>Mês Início</label>
                <select value={filters.mesInicio} onChange={e => handleMonthChange('mesInicio', e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputCls}`}>
                  {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${labelCls}`}>Mês Fim</label>
                <select value={filters.mesFim} onChange={e => handleMonthChange('mesFim', e.target.value)} className={`w-full px-3 py-2 rounded-lg text-sm ${inputCls}`}>
                  {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`block text-sm font-medium ${labelCls}`}>Status</label>
              <button
                onClick={handleSelectAllStatus}
                className={`text-xs font-medium px-2 py-1 rounded transition-colors`}
                style={allSelected ? { background: 'var(--brand-green)', color: 'var(--text-inverse)', opacity: 0.85 } : { color: 'var(--text-muted)' }}
              >
                {allSelected ? 'Desselecionar Todos' : 'Selecionar Todos'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(isDark ? STATUS_OPTIONS : STATUS_OPTIONS_LIGHT).map(status => (
                <button
                  key={status.value}
                  onClick={() => handleStatusToggle(status.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    filters.statuses.includes(status.value)
                      ? status.activeStyle
                      : isDark
                        ? 'glass-badge text-[var(--text-muted)]'
                        : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Botão Limpar */}
          <button
            onClick={handleClearFilters}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'glass-button text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );
}
