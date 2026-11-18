import React from 'react';
import { createRoot } from 'react-dom/client';
import LubricationScheduleTable from '../src/components/LubricationScheduleTable';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import '../src/index.css';
import '../src/styles/lubrificacao.css';
import '../src/styles/mobile-operations-v1011.css';

const schedules = Array.from({ length: 70 }, (_, index) => ({
  id: `scroll-${index + 1}`,
  frota: `${999000 + index}`,
  numeroOS: `SCROLL-${index + 1}`,
  apoioNome: 'Dados sintéticos locais',
  dataProgramada: '2026-11-07',
  horarioAgendado: '07:00',
  tipoPreventiva: index % 2 ? 'Lavagem / Lubrificação' : 'Lubrificação de conjunto',
  descricaoPonto: 'Ponto de teste',
  local: 'Lavador',
  dataRealizada: '',
  situacao: 'PROGRAMADO' as const,
  observacao: `Linha sintética ${index + 1} para validar gesto vertical e horizontal sem rede ou dados reais.`,
  categoria: 'Caminhão',
  lavagem: true,
  lubrificacao: true,
  pulverizacao: false,
  soprar: false,
}));

function Harness() {
  return (
    <ThemeProvider>
      <main className="lub-module lub-operations-v1011" style={{ padding: 16 }}>
        <h1>Lavagem — harness de scroll</h1>
        <p>Reprodução local sem fetch, banco ou autenticação.</p>
        <LubricationScheduleTable
          schedules={schedules as any}
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
      </main>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
