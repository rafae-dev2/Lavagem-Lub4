
const date=new Date().toISOString();
const orders=[
 {chave:'OS-15101',os:'159325249',frota:'15101',modelo:'Carretas Área de Vivência',grupo_fonte:'Carretas Área de Vivência',setor:'Ofc. Elétrica',ponto:'Kango 8838',origem:'Campo',prestador:'',status:'Programada',entrada:'2026-10-08T14:45:00-03:00',previsao:'2026-10-30T23:00:00-03:00',narrativa:'Verificar o conjunto elétrico da carreta, revisar conectores e confirmar o funcionamento antes de liberar o equipamento para a operação.',ativo:true,primeira_vista:'2026-10-08T17:50:00Z',ultima_vista:date,ausente_desde:null},
 {chave:'OS-15115',os:'159330468',frota:'15115',modelo:'Carreta Área de Vivência',grupo_fonte:'Carretas',setor:'Ofc. Mecânica',ponto:'Oficina Externa',origem:'Oficina Externa',prestador:'Oficina Externa São João — Especializada em equipamentos e implementos agrícolas',status:'Andamento',entrada:'2026-10-25T09:30:00-03:00',previsao:'2026-12-08T14:40:00-03:00',narrativa:'Inspecionar o sistema de freios e revisar o implemento. '+('Descrição operacional detalhada sem cortes ou sobreposição. '.repeat(12)),ativo:true,primeira_vista:'2026-10-25T12:35:00Z',ultima_vista:date,ausente_desde:null},
 {chave:'OS-LONG',os:'159339999',frota:'FROTA-CODIGO-123456789012345',modelo:'Equipamento com descrição extensa para testar adaptação em monitores pequenos e smartphones',grupo_fonte:'Equipamentos especiais',setor:'Oficina Interna',ponto:'Ponto não informado',origem:'Oficina Interna',prestador:'',status:'Aguardando Peça',entrada:'2026-11-06T07:00:00-03:00',previsao:'',narrativa:'Sem previsão disponível. Aguardando confirmação da peça necessária para executar o serviço.',ativo:true,primeira_vista:date,ultima_vista:date,ausente_desde:null},
 {chave:'OS-HISTORY',os:'159331208',frota:'4626',modelo:'Caminhão',grupo_fonte:'Caminhões',setor:'Lavador',ponto:'Lavador',origem:'Campo',prestador:'',status:'Andamento',entrada:'2026-11-05T07:00:00-03:00',previsao:'2026-11-05T23:00:00-03:00',narrativa:'Ordem ausente; não concluir apenas pelo desaparecimento da fonte.',ativo:false,primeira_vista:'2026-11-05T10:00:00Z',ultima_vista:'2026-11-05T23:00:00Z',ausente_desde:'2026-11-06T02:11:00Z'},
];
const groups=[{id:'vivencia',nome:'Área de Vivência',cor:'#146333'},{id:'especial',nome:'Equipamentos Especiais',cor:'#ad863b'}];
const fleets=orders.map((o,i)=>({frota:o.frota,grupo_id:i<2?'vivencia':'especial',nome:o.modelo}));
const data={orders,groups,fleets,sync:{id:1,fonte_atualizada:date,consultado_em:date,sincronizado_em:date,total:orders.length,erro:null},role:'admin'};
globalThis.__apoioMock={writes:[],reads:0,syncs:0};
export async function loadApoioData(){globalThis.__apoioMock.reads++;return structuredClone(data);}
export async function syncApoio(){globalThis.__apoioMock.syncs++;}
export async function saveApoioFleet(f){globalThis.__apoioMock.writes.push(f);const v=data.fleets.find(x=>x.frota===f.frota);if(v)Object.assign(v,f);}
export async function saveApoioGroup(g){globalThis.__apoioMock.writes.push(g);}
export async function deleteApoioGroup(id){globalThis.__apoioMock.writes.push({deleteGroup:id});}
export async function deleteApoioFleet(frota){globalThis.__apoioMock.writes.push({deleteFleet:frota});}

