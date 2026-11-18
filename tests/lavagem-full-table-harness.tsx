import React from 'react';
import { createRoot } from 'react-dom/client';
import LubricationScheduleTable from '../src/components/LubricationScheduleTable';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { Programacao, StatusType } from '../src/types';

const statuses: StatusType[] = ['PROGRAMADO', 'PENDENTE', 'ATRASADO', 'ANDAMENTO', 'ENCERRADO'];

const schedules: Programacao[] = Array.from({ length: 70 }, (_, index) => {
  const status = statuses[index % statuses.length];
  const closed = status === 'ENCERRADO';
  return {
    id: `full-table-${index + 1}`,
    frota: `${7000 + index}`,
    numeroOS: `FT-${String(index + 1).padStart(3, '0')}`,
    apoioNome: 'Fixture local sem banco',
    origemRegistro: index % 4 === 0 ? 'PCM' : 'MANUAL',
    statusPCM: index % 4 === 0 ? 'ABERTA' : undefined,
    narrativaPCM: index % 4 === 0 ? `Narrativa sintética da OS ${index + 1}.` : undefined,
    dataProgramada: `2026-11-${String((index % 28) + 1).padStart(2, '0')}`,
    horarioAgendado: `${String(6 + (index % 12)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
    tipoPreventiva: index % 3 === 0 ? 'Lavagem / Lubrificação' : index % 3 === 1 ? 'Lubrificação' : 'Troca de Óleo',
    descricaoPonto: index % 2 ? 'Ponto de teste externo' : 'LAVADOR',
    dataRealizada: closed ? '2026-11-06' : '',
    execucaoConfirmadaEm: closed ? '2026-11-06T12:00:00Z' : undefined,
    situacao: status,
    observacao: `Linha sintética ${index + 1}; observação longa para manter as colunas reais e validar que a tabela não vira cartão em viewport estreito.`,
  };
});

function Harness() {
  const dark = new URLSearchParams(window.location.search).get('theme') === 'dark';
  if (dark) {
    localStorage.setItem('bp-theme', 'dark');
    localStorage.setItem('bp-theme-default-version', 'light-v10.6');
  } else {
    localStorage.removeItem('bp-theme');
    localStorage.removeItem('bp-theme-default-version');
  }

  return (
    <ThemeProvider>
      <div className="app-shell app-shell--lub" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ minHeight: '100vh' }}>
          <main style={{ minHeight: '100vh' }}>
            <section className="lavagem-premium" aria-label="Módulo Lavagem e Lubrificação">
              <div className="lavagem-premium-ribbons" aria-hidden="true" />
              <header className="lavagem-premium-hero">
                <div className="lavagem-premium-brand">
                  <div><p className="lavagem-premium-eyebrow">Fixture de regressão</p><h1>Tabela completa</h1><p>Contexto premium real, sem rede, autenticação ou banco.</p></div>
                </div>
                <strong aria-label="Quantidade de registros">70</strong>
              </header>
              <div className="lavagem-premium-body">
                <div className="lub-module lub-operations-v1011 flex flex-col" style={{ padding: 16 }}>
                  <div className="lub-toolbar"><h2 className="lub-toolbar-title">Programações de serviço</h2><span>Modo tabela selecionado</span></div>
                  <div className="lub-table-panel rounded-xl shadow-sm overflow-hidden">
                    <div className="lub-table-caption"><strong>Ordens de serviço · 70</strong><span>Edição disponível na coluna Ações</span></div>
                    <LubricationScheduleTable
                      schedules={schedules}
                      sortField="frota"
                      sortDir="asc"
                      onSort={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onQuick={() => {}}
                      onPostpone={() => {}}
                      onOpenFrota={() => {}}
                      quickUpdating={null}
                      deleting={null}
                    />
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
