import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import LavagemPremiumLayout from '../src/components/LavagemPremiumLayout';
import LavagemTabs from '../src/components/LavagemTabs';
import Programacoes from '../src/pages/Programacoes';
import Dashboard from '../src/pages/Dashboard';
import Exportar from '../src/pages/Exportar';
import Importar from '../src/pages/Importar';
import type { PageType, Programacao, StatusType } from '../src/types';
import '../src/index.css';
import '../src/styles/glassy-v18.css';
import '../src/styles/glassy-v18-refinements.css';
import '../src/styles/lavagem-premium.css';
localStorage.setItem('bp-theme',new URLSearchParams(location.search).get('theme') || 'light');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
const statuses:StatusType[]=['ATRASADO','PROGRAMADO','PENDENTE','ANDAMENTO','ENCERRADO'];
const initial:Programacao[]=statuses.map((situacao,i)=>({id:`lav-premium-${i}`,frota:String(4508+i),numeroOS:`15932976${i}`,descricaoPonto:'LAVADOR',tipoPreventiva:'Lavagem / Lubrificação',dataProgramada:today,horarioAgendado:'07:00',dataRealizada:situacao==='ENCERRADO'?today:'',situacao,observacao:i===0?'Verificar as condições da lavagem e os pontos de lubrificação. Texto extenso para testar contraste e separação da coluna Ações.':'Sem observações adicionais',narrativaPCM:'Narrativa fictícia integral da ordem para teste, sem informações de produção.',origemRegistro:'PCM',apoioNome:'Caminhões · demonstração',statusPCM:situacao==='ENCERRADO'?'Encerrado':'Programada',encerradoDetectadoEm:situacao==='ENCERRADO'?`${today}T15:00:00-03:00`:undefined}));
function Harness(){
 const [page,setPage]=useState<PageType>('programacoes');
 const [rows,setRows]=useState(initial);
 const [reads,setReads]=useState(0);
 const update=async(id:string,values:Partial<Programacao>)=>{setRows(prev=>prev.map(row=>row.id===id?{...row,...values}:row));return{}};
 const add=async(items:Programacao[])=>{setRows(prev=>[...prev,...items]);return{sheetErrors:[]}};
 const stats={total:rows.length,pendente:1,atrasado:1,programado:1,encerrado:1,andamento:1};
 return <div className="app-shell app-shell--lub"><main><LavagemPremiumLayout refreshing={false} onRefresh={()=>setReads(n=>n+1)}>
 <LavagemTabs current={page} onNavigate={setPage}/>
 {page==='programacoes'?<Programacoes schedules={rows} onUpdate={update} onDelete={async()=>({})} onAdd={add}/>:page==='dashboard'?<Dashboard schedules={rows} allSchedules={rows} stats={stats} loading={false} error={null}/>:page==='exportar'?<Exportar schedules={rows}/>:<Importar onImport={add}/>}
 <output aria-label="Consultas de teste">{reads}</output>
 </LavagemPremiumLayout></main></div>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Harness/></ThemeProvider>);
