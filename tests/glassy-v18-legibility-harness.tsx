import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import Layout from '../src/components/Layout';
import LubricationScheduleTable from '../src/components/LubricationScheduleTable';
import { Programacao, PageType, StatusType } from '../src/types';
import '../src/index.css';
import '../src/styles/lubrificacao.css';
import '../src/styles/glassy-v18.css';
import '../src/styles/glassy-v18-refinements.css';

localStorage.setItem('bp-theme', new URLSearchParams(location.search).get('theme') || 'glassy-v18');
const statuses: StatusType[] = ['ATRASADO', 'PROGRAMADO', 'PENDENTE', 'ANDAMENTO', 'ENCERRADO'];
const rows: Programacao[] = statuses.map((situacao, index) => ({
  id: `teste-${index}`, frota: `${4508 + index}`, numeroOS: `15932976${index}`,
  descricaoPonto: 'LAVADOR', tipoPreventiva: 'Lavagem / Lubrificação',
  dataProgramada: '2026-11-05', horarioAgendado: '07:00',
  dataRealizada: situacao === 'ENCERRADO' ? '2026-11-05' : '', situacao,
  observacao: index === 0 ? 'Verificar programação de lavagem e lubrificação do equipamento. A observação precisa continuar legível sem se misturar com o botão de edição.' : 'Sem observações adicionais',
  narrativaPCM: 'Narrativa fictícia para validar o botão Ver detalhes e a expansão.',
  origemRegistro: 'PCM', apoioNome: 'Caminhões — demonstração', statusPCM: 'Programada',
}));
const noop = () => {};
function Harness() {
  const [page, setPage] = useState<PageType>('programacoes');
  const [edited, setEdited] = useState('');
  return <Layout currentPage={page} onNavigate={setPage} onRefresh={noop} syncing={false} lastSync="05/11/2026 10:55" alertCount={1} alerts={[]} unreadCount={0} browserPermission="default" onRequestPermission={noop} onMarkAsRead={noop} onMarkAllAsRead={noop} onClearAll={noop}>
    <div className="lub-module space-y-5">
      <p style={{color:'var(--text-secondary)',fontSize:12}}>DADOS FICTÍCIOS PARA TESTE VISUAL — nenhuma conexão com o banco.</p>
      <section className="lub-hero"><div className="lub-brand"><img src="/logo.png" alt="Branco Peres"/><div><p className="lub-eyebrow">Controle operacional</p><h2>Lavagem / Lubrificação</h2><p>Programação, situação e acompanhamento das ordens de serviço.</p></div></div><div className="lub-hero-total"><strong>5</strong><span>Ordens na seleção</span></div></section>
      <div className="lub-kpis">{statuses.map((s, i) => <button type="button" className="lub-kpi" key={s}><span className="lub-kpi-label">{s}</span><strong>{i === 0 ? 12 : i + 1}</strong><small>Ordens de serviço</small></button>)}</div>
      <section className="lub-table-panel glass-card"><div className="lub-table-caption"><strong>Ordens de serviço · 5</strong><span>Edição disponível na coluna Ações</span></div><LubricationScheduleTable schedules={rows} sortField="dataProgramada" sortDir="asc" onSort={noop} onEdit={row => setEdited(row.frota)} onDelete={noop} onQuick={noop} onPostpone={noop} onOpenFrota={noop} quickUpdating={null} deleting={null}/></section>
      <output aria-label="Frota editada">{edited}</output>
    </div>
  </Layout>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Harness/></ThemeProvider>);
