import React, { useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useTheme } from '../contexts/ThemeContext';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isDark } = useTheme();
  const { mode, isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  const handleAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  if (variant === 'compact') {
    if (isInstalled) return null;
    if (!isInstallable && !isIOS) return null;

    return (
      <>
        <button
          type="button"
          onClick={() => void handleAction()}
          className={`inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
            isDark
              ? 'bg-white/10 border border-white/15 text-[var(--text-primary)] hover:bg-white/15'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100'
          } ${className}`}
        >
          <Download size={14} aria-hidden="true" />
          <span>{isIOS ? 'Instalar no iPhone' : 'Instalar aplicativo'}</span>
        </button>

        {showGuide && (
          <PWAInstallGuideModal
            isIOS={isIOS}
            isDark={isDark}
            onClose={() => setShowGuide(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <section
        className={`${
          isDark
            ? 'glass-card border border-white/15'
            : 'bg-white border border-gray-200 rounded-xl shadow-sm'
        } p-5 ${className}`}
        aria-label="Instalação do aplicativo na tela inicial"
      >
        <div className="flex items-start gap-4">
          <img
            src="/pwa-192x192.png"
            alt="Ícone do aplicativo Branco Peres"
            width={56}
            height={56}
            className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 shadow-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-sm font-semibold flex items-center gap-1.5 ${
                  isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'
                }`}
              >
                <Smartphone size={15} aria-hidden="true" />
                Aplicativo na Tela Inicial (PWA)
              </h3>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isInstalled
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : isDark
                      ? 'bg-white/10 text-[var(--text-secondary)] border border-white/15'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {isInstalled
                  ? 'Instalado'
                  : mode === 'native'
                    ? 'Pronto para instalar'
                    : 'Compatível com tela inicial'}
              </span>
            </div>
            <p
              className={`text-xs mt-1.5 leading-relaxed ${
                isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'
              }`}
            >
              Instale o sistema com ícones de alta resolução (192×192 e 512×512, padrão e adaptativo) para abrir em tela cheia como aplicativo nativo no celular ou computador.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {isInstalled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Executando em modo aplicativo instalado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAction()}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isDark
                      ? 'bg-[var(--brand-green)] text-[var(--text-inverse,#111827)] hover:opacity-90'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  <Download size={14} aria-hidden="true" />
                  <span>
                    {mode === 'native'
                      ? 'Instalar aplicativo agora'
                      : isIOS
                        ? 'Como instalar no iPhone / iPad'
                        : 'Como instalar na tela inicial'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {showGuide && (
        <PWAInstallGuideModal
          isIOS={isIOS}
          isDark={isDark}
          onClose={() => setShowGuide(false)}
        />
      )}
    </>
  );
};

function PWAInstallGuideModal({
  isIOS,
  isDark,
  onClose,
}: {
  isIOS: boolean;
  isDark: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instruções para instalar o aplicativo"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
          isDark
            ? 'bg-[#2a2c31] border-white/15 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        }`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Branco Peres"
              className="w-10 h-10 rounded-xl"
            />
            <h3 className="text-base font-bold">
              {isIOS ? 'Instalar no iPhone / iPad' : 'Instalar na Tela Inicial'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar instruções"
            className="p-1.5 rounded-full hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {isIOS ? (
          <ol className="mt-4 space-y-2.5 text-sm opacity-90 list-decimal list-inside">
            <li>
              Toque no botão <strong className="inline-flex items-center gap-1"><Share size={13} /> Compartilhar</strong> na barra do Safari.
            </li>
            <li>
              Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Confirme em <strong>Adicionar</strong> para abrir em tela cheia.
            </li>
          </ol>
        ) : (
          <ol className="mt-4 space-y-2.5 text-sm opacity-90 list-decimal list-inside">
            <li>
              Abra o menu do navegador (<strong>⋮</strong> no Chrome/Edge Android ou ícone de instalação na barra de endereços no computador).
            </li>
            <li>
              Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
            </li>
            <li>
              Confirme para fixar o ícone de alta resolução da <strong>Branco Peres</strong>.
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`mt-5 w-full rounded-full py-2.5 text-sm font-semibold cursor-pointer ${
            isDark
              ? 'bg-[#f6f7f8] text-[#16191d] hover:opacity-90'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

export default PWAInstallButton;
