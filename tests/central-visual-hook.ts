import { useState } from 'react';
import type { ApoioData, ApoioOrder } from '../src/types/apoio';
const now = new Date('2026-11-08T15:00:00Z');
const names = ['Carretas Canavieiras','Trator Transbordo','Colhedoras','Carretas Rodomuda','Trator Reboque','Caminhões Munck','Área de Vivência','Cavalos Mecânicos','Prancha','Veículos Leves','Tanques','Pipas'];
const groups = names.map((nome,index)=>({id:`test-${index}`,nome,cor:'#185b3d'}));
const fleets = Array.from({length:60},(_,index)=>({frota:`TEST-${100+index}`,grupo_id:groups[index%groups.length].id,nome:`Equipamento de teste ${index+1}`}));
const statuses = ['Programada','Andamento','Aguardando Peça','Pendente','Programada','Programada','Programada'];
const orders:ApoioOrder[] = fleets.map((fleet,index)=>{
 const age = (index*7)%92+0.5;
 const entry = new Date(now.getTime()-age*86400000).toISOString();
 const closed=index%9===0;
 const first = new Date(Date.parse(entry)+3600000).toISOString();
 const last = closed ? new Date(now.getTime()-7200000).toISOString() : now.toISOString();
 return {chave:`${fleet.frota}::TEST-OS-${index+1}`,os:`TEST-OS-${index+1}`,frota:fleet.frota,modelo:`Modelo de teste ${index%5+1}`,grupo_fonte:'Grupo da fonte de teste',setor:index%2?'Manutenção industrial':'Apoio agrícola',ponto:index%3?'Oficina Geral':'Pátio Equipamentos',origem:index%4===0?'Oficina Externa':index%5===0?'Campo':'Oficina Interna',prestador:index%4===0?(index%8===0?'Prestador Beta':'Prestador Alfa'):'',status:statuses[index%statuses.length],entrada:entry,previsao:new Date(now.getTime()+((index%8)-4)*86400000).toISOString(),narrativa:`DADO SINTÉTICO PARA TESTE — inspeção preventiva, revisão do conjunto hidráulico e troca de peças do equipamento ${fleet.frota}. Narrativa integral para validar pesquisa e detalhes.`,ativo:!closed,primeira_vista:first,ultima_vista:last,ausente_desde:closed?new Date(now.getTime()-3600000).toISOString():null,classe:index%3?'Preventiva':'Corretiva',motivo:index%3?'Inspeção':'Falha identificada'};
});
orders.push({...orders[1],chave:'UNREGISTERED-TEST',os:'TEST-EXTERNAL',frota:'TEST-999',grupo_fonte:'Grupo sem cadastro de teste',narrativa:'DADO SINTÉTICO PARA TESTE — ordem externa sem frota cadastrada.'});
const data:ApoioData={groups,fleets,orders,role:'viewer',sync:{id:1,fonte_atualizada:'2026-11-08T14:40:00Z',consultado_em:'2026-11-08T15:00:00Z',sincronizado_em:'2026-11-08T15:00:00Z',total:orders.length,erro:null}};
export const MAINTENANCE_REFRESH_EVENT='bp:maintenance-refresh';
export const MAINTENANCE_STATE_EVENT='bp:maintenance-state';
export function useMaintenanceTracking(){const [refreshing,setRefreshing]=useState(false);return {data,loading:false,refreshing,error:'',clock:now,refresh:async()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),40);}};}

export const MAINTENANCE_CENTRAL_REFRESH_MS = 5 * 60_000;
