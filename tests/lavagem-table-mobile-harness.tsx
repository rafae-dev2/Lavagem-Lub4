import React from 'react';
import {createRoot} from 'react-dom/client';
import LubricationScheduleTable from '../src/components/LubricationScheduleTable';
import {ThemeProvider} from '../src/contexts/ThemeContext';
import '../src/index.css';
import '../src/styles/mobile-operations-v1011.css';
const schedule={id:'demo',frota:'999008',numeroOS:'DEMO-123',apoioNome:'Caminhão Caçamba',dataProgramada:'2026-11-07',horarioAgendado:'07:00',tipoPreventiva:'Lavagem / Lubrificação',local:'Lavador',dataRealizada:'',situacao:'ATRASADO' as const,observacao:'Demonstração — sem acesso ao banco',categoria:'Caminhão Caçamba',lavagem:true,lubrificacao:true,pulverizacao:false,soprar:false};
function Harness(){const [cards,setCards]=React.useState(false);return <ThemeProvider><main className="lub-module lub-operations-v1011" style={{padding:16}}><h1>Lavagem — dados simulados</h1><div style={{display:'flex',gap:12,margin:'16px 0'}}><button onClick={()=>setCards(false)} aria-pressed={!cards}>Tabela</button><button onClick={()=>setCards(true)} aria-pressed={cards}>Cartões</button></div><LubricationScheduleTable schedules={[schedule] as any} compactCards={cards} sortField="frota" sortDir="asc" onSort={()=>{}} onEdit={()=>{}} onDelete={()=>{}} onQuick={()=>{}} onPostpone={()=>{}} onOpenFrota={()=>{}} quickUpdating={null} deleting={null}/></main></ThemeProvider>}
createRoot(document.getElementById('root')!).render(<Harness/>);
