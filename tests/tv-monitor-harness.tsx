import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TVMonitor from '../src/components/TVMonitor';
import { ApoioData, ApoioOrder } from '../src/types/apoio';
import '../src/index.css';

const now = Date.now();
const iso = (hours: number) => new Date(now + hours * 3600000).toISOString();
const base = { ativo:true, classe:'CORRET EMERGENCIAL', status:'Andamento', grupo_fonte:'Grupo da fonte', ausente_desde:null, primeira_vista:iso(-48), ultima_vista:iso(0) };
const details = [
  ['4508','Caminhão Caçamba','ca','Oficina','Ofc.Interna','MECÂNICO','Verificar vazamento no sistema hidráulico e perda de pressão. Equipamento encaminhado para diagnóstico na oficina interna.'],
  ['4582','Caminhão Munck','mu','Terceiro','Ofc.Externa','ELÉTRICA','Falha elétrica no acionamento do guindaste. Oficina externa avaliando chicote e módulo de comando.'],
  ['32242','Trator agrícola','tr','Campo','Ofc.Campo','MECÂNICO','Verificar falha no sistema de transmissão. Técnico atendendo o equipamento em campo.'],
  ['4509','Caminhão Caçamba','ca','Oficina','Ofc.Interna','HIDRÁULICO','Vazamento de óleo no cilindro de basculamento. Revisar conexões e mangueiras.'],
  ['4583','Caminhão Munck','mu','Oficina','Ofc.Interna','MECÂNICO','Verificar folga na articulação do guindaste e condição dos pinos.'],
  ['32246','Trator agrícola','tr','Terceiro','Ofc.Externa','ELÉTRICA','Falha de partida. Oficina externa realizando diagnóstico do sistema elétrico.'],
  ['4510','Caminhão Caçamba','ca','Campo','Ofc.Campo','MECÂNICO','Superaquecimento. Verificar sistema de arrefecimento e a vedação do reservatório.'],
  ['4584','Caminhão Munck','mu','Oficina','Ofc.Interna','HIDRÁULICO','Verificar oscilação de pressão no circuito hidráulico do guindaste.'],
];
const orders: ApoioOrder[] = details.map(([frota,modelo,group,origem,setor,motivo,narrativa],i) => ({...base, chave:`${frota}::100${i}`, os:`100${i}`, frota, modelo, origem, setor, motivo, narrativa, ponto:origem === 'Campo' ? 'Frente de trabalho' : 'Oficina de manutenção', prestador:origem === 'Terceiro' ? 'Oficina Parceira — demonstração' : '', entrada:iso(-48+i*4), previsao:iso(i%2 ? 6 : -3)}));
const data: ApoioData = { role:'viewer', groups:[{id:'ca',nome:'Caminhões Caçamba',cor:'#f88'},{id:'mu',nome:'Caminhões Munck',cor:'#8bf'},{id:'tr',nome:'Tratores',cor:'#8f9'}], fleets:details.map(([frota,nome,grupo_id]) => ({frota,nome,grupo_id})), orders, sync:{id:1,fonte_atualizada:iso(0),consultado_em:iso(0),sincronizado_em:iso(0),total:8,erro:null} };

const responsiveNarrative = Array.from({length:38}, (_,index) => `Registro fictício ${index + 1}: o equipamento foi recebido para diagnóstico, conferência de segurança, desmontagem parcial, validação do conjunto hidráulico e atualização do plano de manutenção. A equipe deve documentar cada evidência, preservar a rastreabilidade da ordem e confirmar a liberação operacional antes de encerrar o atendimento.`).join(' ').slice(0, 2000);
const responsiveProvider = 'Oficina Terceirizada Especializada em Equipamentos Agrícolas e Rodoviários — Unidade de Atendimento Externo, responsável técnico e logística de peças para demonstração responsiva.'.repeat(3).slice(0, 320);
const responsiveEquipment = 'Caminhão basculante articulado de demonstração com implemento hidráulico de grande porte e identificação operacional estendida';
const responsiveSector = 'Mecânica pesada, hidráulica, elétrica e inspeção de segurança operacional';
const responsivePoint = 'Pátio de manutenção externa — área de recebimento e triagem de equipamentos';
const responsiveReason = 'MECÂNICO — diagnóstico integrado do conjunto de transmissão, freios e circuito hidráulico';

function responsiveOrders(count: number): ApoioOrder[] {
  const total = Math.max(1, Math.min(35, Math.floor(Number.isFinite(count) ? count : 5)));
  return Array.from({length:total}, (_,index) => {
    const external = index % 2 === 1;
    const frota = index === 0 ? '123456789' : `123456${String(index).padStart(3, '0')}`;
    const os = index === 0 ? 'OS-2026-123456789-ATENDIMENTO-INTEGRADO-LINHA-PRIORITARIA' : `OS-2026-${String(700000 + index)}-MANUTENCAO-${String(index + 1).padStart(2, '0')}`;
    const group = index % 3 === 0 ? 'ca' : index % 3 === 1 ? 'mu' : 'tr';
    return {
      ...base,
      chave:`responsive-${frota}::${os}`,
      os,
      frota,
      modelo:responsiveEquipment,
      origem:external ? 'Terceiro' : 'Oficina',
      setor:responsiveSector,
      motivo:responsiveReason,
      narrativa:responsiveNarrative,
      ponto:responsivePoint,
      prestador:external ? responsiveProvider : '',
      entrada:iso(-48 - index),
      previsao:iso(index % 4 === 0 ? -3 : 8),
      classe:'CORRET EMERGENCIAL',
      status:'Andamento',
      grupo_fonte:`Grupo fictício ${group.toUpperCase()} para validação do layout`,
      ativo:true,
      primeira_vista:iso(-96 - index),
      ultima_vista:iso(-1),
      ausente_desde:null,
    };
  });
}

function responsiveData(count: number): ApoioData {
  const responsive = responsiveOrders(count);
  return {
    role:'viewer',
    groups:[
      {id:'ca',nome:'Caminhões Caçamba — grupo responsivo',cor:'#f88'},
      {id:'mu',nome:'Caminhões Munck — grupo responsivo',cor:'#8bf'},
      {id:'tr',nome:'Tratores agrícolas — grupo responsivo',cor:'#8f9'},
    ],
    fleets:responsive.map(order => ({frota:order.frota,nome:order.modelo,grupo_id:order.grupo_fonte.includes('MU') ? 'mu' : order.grupo_fonte.includes('TR') ? 'tr' : 'ca'})),
    orders:responsive,
    sync:{id:2,fonte_atualizada:iso(0),consultado_em:iso(0),sincronizado_em:iso(0),total:responsive.length,erro:null},
  };
}

function Harness() {
  const [snapshot,setSnapshot] = useState(data);
  const [error,setError] = useState<string|null>(null);
  const setResponsive = (count: number) => { setError(null); setSnapshot(responsiveData(count)); };
  (window as any).tvTestUpdate = () => setSnapshot(d => ({...d,orders:d.orders.map((o,i)=>i===0?{...o,status:'Programada'}:o)}));
  (window as any).tvTestMany = () => {
    const manyOrders: ApoioOrder[] = Array.from({length:35},(_,i)=>({...base,chave:`${5000+i}::${2000+i}`,frota:String(5000+i),os:String(2000+i),modelo:'Equipamento demonstração',origem:i<20?'Oficina':'Terceiro',prestador:i<20?'':'Oficina Premium Externa',status:i<20?'Andamento':'Programada',classe:i<20?'CORRET EMERGENCIAL':'CORRET PROGRAMADA',motivo:'MECÂNICO',setor:'Mecânica',ponto:'Manutenção',narrativa:'Verificar transmissão e concluir reparo do equipamento. Dados fictícios para teste do monitor.',entrada:iso(-48+i),previsao:iso(6)}));
    setSnapshot(d=>({...d,orders:manyOrders,fleets:manyOrders.map(o=>({frota:o.frota,nome:o.modelo,grupo_id:'ca'})),sync:{...d.sync!,fonte_atualizada:iso(0)}}));
  };
  (window as any).tvTestResponsive = (count: number = 5) => { setResponsive(count); return count; };
  (window as any).tvTestError = () => setError('Falha simulada de rede');
  (window as any).tvTestStale = () => setSnapshot(d=>({...d,sync:{...d.sync!,fonte_atualizada:iso(-2)}}));
  return <div style={{background:'#0a1318',minHeight:'100vh',padding:16}}><p style={{color:'#c7ddd8',fontSize:11,marginBottom:10}}>PRÉVIA COM DADOS FICTÍCIOS — sem acesso ao banco.</p><TVMonitor data={snapshot} loading={false} refreshing={false} error={error} connection="live" lastReadAt={iso(0)} refresh={() => setSnapshot(d=>({...d}))}/></div>;
}

createRoot(document.getElementById('root')!).render(<Harness/>);
