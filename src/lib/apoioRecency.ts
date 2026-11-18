import type { ApoioReportRow } from '../types/apoio';
import { parseLocalDateTime, getLocalDateStr } from './scheduleVisibility';

export type ApoioRecencyBasis = 'entrada' | 'primeira_vista';
export type ApoioRecencySort = 'organized' | 'newest' | 'oldest';
export type ApoioRecencyWindow = 'all' | '1h' | '6h' | '24h' | '7d' | 'today' | 'custom';
export interface ApoioRecencyOptions {
  basis: ApoioRecencyBasis;
  sort: ApoioRecencySort;
  window: ApoioRecencyWindow;
  start: string;
  end: string;
  scheduledAndRunning: boolean;
}
export const DEFAULT_APOIO_RECENCY: ApoioRecencyOptions = {
  basis: 'entrada', sort: 'organized', window: 'all', start: '', end: '', scheduledAndRunning: false,
};

/** ISO civil estrito: timestamps sem zona são Brasília, nunca o fuso do computador. */
export function apoioRecencyTimestamp(raw: string | null | undefined): number | null {
  const value=raw?.trim(); if(!value) return null;
  const m=/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if(!m) return null;
  const civil=parseLocalDateTime(m[1],m[2]?`${m[2]}:${m[3]||'00'}`:'00:00:00');
  if(!civil)return null;
  const timestamp=m[4]?Date.parse(value.replace(' ','T')):civil.getTime();
  return Number.isFinite(timestamp)?timestamp:null;
}

export function apoioRecencyBounds(options: ApoioRecencyOptions, now=new Date()): {start:number;end:number;error:string} {
  const time=now.getTime();
  if(!Number.isFinite(time))return {start:Infinity,end:-Infinity,error:'Horário de referência inválido.'};
  if(options.window==='all')return {start:-Infinity,end:Infinity,error:''};
  if(options.window==='custom') {
    const start=options.start?parseLocalDateTime(options.start,'00:00:00'):null;
    const end=options.end?parseLocalDateTime(options.end,'23:59:59'):null;
    if((options.start&&!start)||(options.end&&!end))return {start:Infinity,end:-Infinity,error:'Informe datas válidas para o intervalo.'};
    const lower=start?.getTime()??-Infinity;
    const upper=end?Math.min(end.getTime()+999,time):time;
    if(lower>upper)return {start:Infinity,end:-Infinity,error:'A data inicial deve ser anterior ou igual à data final e não pode estar no futuro.'};
    return {start:lower,end:upper,error:''};
  }
  const hours:Partial<Record<ApoioRecencyWindow,number>>={'1h':1,'6h':6,'24h':24,'7d':168};
  const start=options.window==='today'?parseLocalDateTime(getLocalDateStr(now),'00:00:00')!.getTime():time-(hours[options.window]??0)*3600000;
  return {start,end:time,error:''};
}

export function selectApoioRecency(rows: ApoioReportRow[],options: ApoioRecencyOptions,now=new Date()): ApoioReportRow[] {
  const {start,end,error}=apoioRecencyBounds(options,now);
  if(error)return [];
  const timestamp=(row:ApoioReportRow)=>apoioRecencyTimestamp(row[options.basis]);
  const filtered=rows.filter(row=>{
    if(options.scheduledAndRunning&&!['Programada','Andamento'].includes(row.status))return false;
    if(options.window==='all')return true;
    const time=timestamp(row);return time!==null&&time>=start&&time<=end;
  });
  if(options.sort==='organized')return filtered;
  const nowTime=now.getTime();
  return filtered.map((row,index)=>({row,index,time:timestamp(row)})).sort((a,b)=>{
    const validA=a.time!==null&&a.time<=nowTime;
    const validB=b.time!==null&&b.time<=nowTime;
    if(validA!==validB)return validA?-1:1;
    if(validA&&validB&&a.time!==b.time)return options.sort==='newest'?b.time!-a.time!:a.time!-b.time!;
    return a.row.os.localeCompare(b.row.os,'pt-BR',{numeric:true})||a.row.chave.localeCompare(b.row.chave)||a.index-b.index;
  }).map(item=>item.row);
}

export function apoioRecencySummary(options:ApoioRecencyOptions):string {
  const basis=options.basis==='entrada'?'Entrada da OS':'Primeira detecção no Apoio';
  const periods:Record<ApoioRecencyWindow,string>={all:'Sem limite de período','1h':'Última hora','6h':'Últimas 6 horas','24h':'Últimas 24 horas','7d':'Últimos 7 dias',today:'Hoje (Brasília)',custom:`${options.start||'Sem início'} até ${options.end||'Agora'} (Brasília)`};
  const order=options.sort==='newest'?'Mais recentes primeiro':options.sort==='oldest'?'Mais antigas primeiro':'Agrupadas por Apoio/oficina';
  return `${order} · ${periods[options.window]} · ${basis}${options.scheduledAndRunning?' · Programadas e em andamento':''}`;
}
