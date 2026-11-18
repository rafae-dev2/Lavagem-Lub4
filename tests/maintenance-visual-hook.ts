const now = new Date('2026-11-08T12:00:00-03:00');
const order = (index:number) => ({ chave:`23677::VISUAL-${index}`,os:`VISUAL-${index}`,frota:'23677',modelo:'Carreta Canavieira',grupo_fonte:'Carretas Canavieiras',setor:'Mecânica',ponto:'Plano preventivo',origem:'Oficina',prestador:'Oficina de manutenção — equipe responsável',status:index%3===0?'Programada':'Andamento',entrada:'2026-11-07T08:00:00-03:00',previsao:index%3===0?'2026-11-07':'2026-11-10',narrativa:`Ordem sintética ${index}: preventiva mecânica, lubrificação e reforma do conjunto de apoio. Revisão de pontos, chassi e componentes; equipamentos identificados, execução conforme programação.`,ativo:index%3!==2,primeira_vista:'2026-11-07T08:00:00-03:00',ultima_vista:'2026-11-08T08:00:00-03:00',ausente_desde:index%3===2?'2026-11-08T09:00:00-03:00':null,motivo:'Preventiva mecânica',classe:'PREVENTIVA',cd_ponto:'99'});
const equipment:Record<string,{fleet:string;group:string;model:string}>={
 'reformas-rodomuda':{fleet:'30953',group:'Carreta Rodomuda',model:'Carreta Rodomuda 30953'},
 'reformas-colhedoras':{fleet:'57839',group:'Colhedora',model:'JD Colhedora Cana CH570'},
 'reformas-trator-transbordo':{fleet:'32308',group:'Trator Transbordo',model:'NH Trator T7.245 4x4'},
 'reformas-trator-reboque':{fleet:'32299',group:'Trator Reboque',model:'Trator Reboque NH'},
};
export function useMaintenanceTracking() {
 const module = new URLSearchParams(location.search).get('module') || 'preventivas';
 const identity=equipment[module] || {fleet:'23677',group:'Carretas Canavieiras',model:'Carreta Canavieira 23677'};
 const reform=module==='reformas'||module.startsWith('reformas-');
 const orders=Array.from({length:26},(_,i)=>({...order(i),chave:`${identity.fleet}::VISUAL-${i}`,frota:identity.fleet,modelo:identity.model,grupo_fonte:identity.group,motivo:module==='lubrificacao'?'Lubrificação':reform?'Reforma':'Preventiva mecânica',classe:reform?'REFORMA':'PREVENTIVA',ponto:module==='lubrificacao'?'Lub Lavador 99 BP':reform?'Plano de reforma':'Plano preventivo'}));
 const data={groups:[{id:'equipamento',nome:identity.group,cor:'#18733d'}],fleets:[{frota:identity.fleet,grupo_id:'equipamento',nome:identity.model}],orders,sync:{id:1,fonte_atualizada:now.toISOString(),sincronizado_em:now.toISOString(),consultado_em:now.toISOString(),erro:null,total:26},role:'admin'};
 return {data,loading:false,refreshing:false,error:'',refresh:async()=>{},clock:now};
}
