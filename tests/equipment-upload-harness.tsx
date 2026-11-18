import React from 'react';
import {createRoot} from 'react-dom/client';
import EquipmentImageManager from '../src/components/EquipmentImageManager';
import EquipmentThumbnail from '../src/components/EquipmentThumbnail';
import {buildTrackingPDF,exportTrackingExcel} from '../src/lib/maintenanceTrackingReport';
import '../src/index.css';
const row={chave:'OS-CUSTOM',os:'OSCUSTOM001',frota:'999001',equipamento:'Equipamento cadastrado',apoio:'Grupo de teste sem imagem',modelo:'',grupo_fonte:'Grupo desconhecido',setor:'Apoio',ponto:'Reforma',origem:'Oficina',prestador:'Oficina teste',status:'PROGRAMADA',trackingStatus:'programado' as const,entrada:'2026-11-07T08:00:00-03:00',previsao:'2026-11-09',narrativa:'Dados simulados — imagem personalizada por grupo',ativo:true,primeira_vista:'2026-11-07T08:00:00-03:00',ultima_vista:'2026-11-08T08:00:00-03:00',ausente_desde:null,classificationReason:'Dados simulados',overdue:false};
const options={rows:[row],module:'reformas' as const,filters:['Demonstração local — grupo personalizado'],sourceUpdated:null,lastSynced:null};
function Harness(){const [error,setError]=React.useState('');async function run(work:()=>Promise<unknown>){try{setError('');await work();}catch(e){setError(String(e));}}return <main style={{padding:20,maxWidth:1100,margin:'auto'}}><h1>Cadastro de imagens — dados simulados</h1><EquipmentImageManager/><section id="custom-consumer" style={{padding:20,display:'flex',alignItems:'center',gap:12}}><EquipmentThumbnail equipment={row} size="card"/><strong>Frota {row.frota} · OS {row.os}</strong></section><button onClick={()=>void run(async()=>{const pdf=await buildTrackingPDF(options);pdf.save('grupo-personalizado.pdf');})}>PDF com imagem do grupo</button><button onClick={()=>void run(()=>exportTrackingExcel(options))}>Excel com imagem do grupo</button><p role="alert">{error}</p></main>}
createRoot(document.getElementById('root')!).render(<Harness/>);
