import React from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, AlertTriangle, Clock, Info, BellOff } from 'lucide-react';
import { AppAlert, AlertSeverity } from '../hooks/useNotifications';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  alerts: AppAlert[];
  unreadCount: number;
  browserPermission: NotificationPermission;
  onRequestPermission: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

const severityConfig: Record<AlertSeverity, {
  icon: React.ComponentType<any>;
  iconColor: string;
  iconColorDark: string;
  bg: string;
  bgDark: string;
  border: string;
  borderDark: string;
}> = {
  critical: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconColorDark: 'text-red-400',
    bg: 'bg-red-50',
    bgDark: 'bg-red-950/40',
    border: 'border-red-200',
    borderDark: 'border-red-800/50',
  },
  warning: {
    icon: Clock,
    iconColor: 'text-amber-600',
    iconColorDark: 'text-amber-400',
    bg: 'bg-amber-50',
    bgDark: 'bg-amber-950/40',
    border: 'border-amber-200',
    borderDark: 'border-amber-800/50',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600',
    iconColorDark: 'text-blue-400',
    bg: 'bg-blue-50',
    bgDark: 'bg-blue-950/40',
    border: 'border-blue-200',
    borderDark: 'border-blue-800/50',
  },
};

export default function NotificationPanel({
  alerts, unreadCount, browserPermission,
  onRequestPermission, onMarkAsRead, onMarkAllAsRead, onClearAll
}: Props) {
  const [open, setOpen] = React.useState(false);
  const { isDark } = useTheme();

  const handleOpen = () => {
    setOpen(o => !o);
    // Solicitar permissão na primeira abertura
    if (browserPermission === 'default') {
      onRequestPermission();
    }
  };

  return (
    <div className="relative">
      {/* Botão sino */}
      <button
        onClick={handleOpen}
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          isDark
            ? 'hover:bg-white/10 text-gray-300 hover:text-white'
            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
        }`}
        title="Notificações"
      >
        <Bell size={20} className={unreadCount > 0 ? (isDark ? 'text-yellow-400' : 'text-amber-500') : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Painel dropdown — renderizado em portal no body para NUNCA ficar
          atrás dos cards (escapa do stacking context do cabeçalho com blur). */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div className={`
            fixed top-16 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-96 max-h-[520px] flex flex-col
            rounded-2xl shadow-2xl border z-[9999] overflow-hidden
            ${isDark
              ? 'bg-[var(--bg-secondary)] border-white/10 shadow-black/60'
              : 'bg-white border-gray-200 shadow-gray-300/50'
            }
          `}>
          {/* Header do painel */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            isDark ? 'glass-card' : 'border-gray-100 bg-gray-50'
          }`}>
            <div className="flex items-center gap-2">
              <Bell size={16} className={isDark ? 'text-yellow-400' : 'text-amber-500'} />
              <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>
                Notificações
              </span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                    isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500'
                  }`}
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500'
                }`}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Permissão do browser */}
          {browserPermission === 'default' && (
            <div className={`mx-3 mt-3 px-3 py-2.5 rounded-xl border flex items-center gap-2 ${
              isDark ? 'bg-yellow-950/40 border-yellow-700/50' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <BellOff size={14} className={isDark ? 'text-yellow-400' : 'text-yellow-600'} />
              <p className={`text-xs flex-1 ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Ative as notificações do sistema para receber alertas
              </p>
              <button
                onClick={onRequestPermission}
                className="text-xs font-semibold bg-yellow-500 text-black px-2 py-1 rounded-lg hover:bg-yellow-400 transition-colors whitespace-nowrap"
              >
                Ativar
              </button>
            </div>
          )}

          {/* Lista de alertas */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
            {alerts.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-12 gap-3 ${
                isDark ? 'text-gray-600' : 'text-gray-400'
              }`}>
                <Bell size={32} className="opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              alerts.map(alert => {
                const cfg = severityConfig[alert.severity];
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    onClick={() => onMarkAsRead(alert.id)}
                    className={`
                      flex gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150
                      ${alert.read ? 'opacity-50' : 'opacity-100'}
                      ${isDark
                        ? `${cfg.bgDark} ${cfg.borderDark} hover:brightness-125`
                        : `${cfg.bg} ${cfg.border} hover:brightness-95`
                      }
                    `}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${isDark ? cfg.iconColorDark : cfg.iconColor}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-tight ${
                        isDark ? 'text-white' : 'text-gray-800'
                      }`}>
                        {alert.title}
                      </p>
                      <p className={`text-xs mt-0.5 leading-relaxed ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {alert.message}
                      </p>
                    </div>
                    {!alert.read && (
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className={`px-4 py-2.5 border-t flex justify-end ${
              isDark ? 'glass-card' : 'border-gray-100 bg-gray-50'
            }`}>
              <button
                onClick={onClearAll}
                className={`text-xs transition-colors ${
                  isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
                }`}
              >
                Limpar todas
              </button>
            </div>
          )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
