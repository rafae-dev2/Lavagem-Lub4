import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'Ocorreu uma falha inesperada na interface.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown): void {
    const text = error instanceof Error ? error.message : String(error ?? '');
    if (
      typeof window !== 'undefined' &&
      /reading 'use(Effect|State|Context|Memo|Ref)'|dynamically imported module|Loading chunk/i.test(
        text,
      )
    ) {
      const key = 'bp_chunk_recover_ts';
      const now = Date.now();
      const last = Number(sessionStorage.getItem(key) || '0');
      if (now - last > 5_000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: 'var(--bg-primary, #060e09)',
          color: 'var(--text-primary, #f2f7f0)',
        }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-6 border text-center space-y-4"
          style={{
            background: 'var(--glass-card-bg, rgba(11, 22, 15, 0.88))',
            borderColor: 'var(--border-primary, rgba(208, 236, 182, 0.2))',
          }}
        >
          <h1 className="text-lg font-bold">Atualização de interface necessária</h1>
          <p className="text-sm opacity-80 break-words">
            {this.state.message || 'Recarregue a página para sincronizar a versão mais recente.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{
              background: 'var(--brand-green, #b7ed40)',
              color: 'var(--text-inverse, #07140b)',
            }}
          >
            Recarregar aplicativo
          </button>
        </div>
      </div>
    );
  }
}
