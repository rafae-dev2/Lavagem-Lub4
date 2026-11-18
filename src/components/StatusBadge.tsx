import { StatusType } from '../types';

interface Props {
  status: StatusType;
  size?: 'sm' | 'md';
}

const config: Record<StatusType, { label: string; className: string; dot: string; pulse?: boolean }> = {
  PENDENTE:   {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-900 border-amber-400 shadow-amber-200/60',
    dot: 'bg-amber-500',
  },
  ATRASADO:   {
    label: 'Atrasado',
    className: 'bg-red-100 text-red-900 border-red-400 shadow-red-200/60',
    dot: 'bg-red-500',
    pulse: true,
  },
  PROGRAMADO: {
    label: 'Programado',
    className: 'bg-blue-100 text-blue-900 border-blue-400 shadow-blue-200/60',
    dot: 'bg-blue-500',
  },
  ENCERRADO:  {
    label: 'Encerrado',
    className: 'bg-green-100 text-green-900 border-green-400 shadow-green-200/60',
    dot: 'bg-green-500',
  },
  ANDAMENTO:  {
    label: 'Andamento',
    className: 'bg-purple-100 text-purple-900 border-purple-400 shadow-purple-200/60',
    dot: 'bg-purple-500',
    pulse: true,
  },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const c = config[status] ?? config.PENDENTE;
  const statusSlug = status.toLowerCase();
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  return (
    <span className={`status-badge status-badge-${statusSlug} inline-flex items-center rounded-full border font-semibold shadow-sm ${c.className} ${sizeClass}`} data-status={status}>
      <span data-status-dot={status} aria-hidden="true" className={`rounded-full flex-shrink-0 ${c.dot} ${c.pulse ? 'animate-pulse' : ''} ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {c.label}
    </span>
  );
}
