import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertTriangle, Building2, ChevronLeft, ChevronRight, Clock3, Filter, Maximize2, Monitor, Pause, Play, RefreshCw, Search, Settings2, Sun, Moon, X } from 'lucide-react';
import { ApoioData, ApoioReportRow, oficinaLabel } from '../types/apoio';
import { defaultTVFilters, isEmergencyOrder, selectTVOrders, selectTVExternalOrders, TVFilters, tvDateTimestamp, tvDeadlineState } from '../lib/tvOrders';
import {getTVLayout} from '../lib/tvLayout';
import EquipmentThumbnail from './EquipmentThumbnail';
import AmbientBrandWatermark from './AmbientBrandWatermark';
import '../styles/tv-monitor.css';

export interface TVMonitorProps {
  initialPanel?: TVPanel;
  data: ApoioData | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  connection: string;
  lastReadAt: string | number | null;
  refresh: () => void | Promise<void>;
}
export type TVPanel = 'emergency' | 'external';
const STORAGE = 'bp-tv-monitor-v1';
interface MonitorConfig {
  filters: TVFilters; externalFilters: TVFilters; pageSize: number; seconds: number;
  rotate: boolean; alternate: boolean; screenSeconds: number; theme: 'light' | 'dark';
}
const externalDefaults: TVFilters = {...defaultTVFilters, groups: [], emergencyOnly:false, status:'abertas', location:'Oficina Externa'};
function baseConfig(): MonitorConfig { return {
  filters: { ...defaultTVFilters, groups: [] }, externalFilters:{...externalDefaults,groups:[]},
  pageSize:0, seconds:20, rotate:true, alternate:true, screenSeconds:12, theme:'dark',
}; }
function readFilters(f: any, base: TVFilters): TVFilters {
  if (!f || typeof f !== 'object') return {...base,groups:[]};
  return {...base,
    groups: f.groups === undefined ? [] : Array.isArray(f.groups) && f.groups.every((g: unknown) => typeof g === 'string' && g.trim()) ? f.groups : ['__none__'],
    query:typeof f.query === 'string' ? f.query : '', location:typeof f.location === 'string' ? f.location : base.location,
    provider:typeof f.provider === 'string' ? f.provider : '', sector:typeof f.sector === 'string' ? f.sector : '',
    reason:typeof f.reason === 'string' ? f.reason : '', minDays:[0,1,3,7,15,30].includes(f.minDays) ? f.minDays : 0,
    sort:['oldest','newest','fleet','deadline'].includes(f.sort) ? f.sort : 'oldest',
    status:['Andamento','abertas'].includes(f.status) ? f.status : base.status,
    emergencyOnly:f.emergencyOnly === undefined ? base.emergencyOnly : f.emergencyOnly !== false,
  };
}
function readConfig(): MonitorConfig {
  const base=baseConfig();
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(!saved || typeof saved !== 'object')return base;
    return {...base, filters:readFilters(saved.filters,base.filters),
      externalFilters:{...readFilters(saved.externalFilters,base.externalFilters),location:'Oficina Externa',emergencyOnly:false},
      pageSize:[0,4,6,8,12].includes(saved.pageSize) ? saved.pageSize : 0,
      seconds:[10,20,30,60].includes(saved.seconds) ? saved.seconds : 20,
      rotate:saved.rotate !== false, alternate:saved.alternate !== false,
      screenSeconds:[5,10,12,15,20,30,60].includes(saved.screenSeconds) ? saved.screenSeconds : 12,
      theme:saved.theme==='light' ? 'light' : 'dark',
    };
  } catch{return base;}
}
function dateText(value: string | null | undefined): string {
  if (!value) return 'Não informada';
  const timestamp = tvDateTimestamp(value);
  if (timestamp === null || !Number.isFinite(timestamp)) return 'Data inválida';
  const options: Intl.DateTimeFormatOptions = {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)){options.hour='2-digit';options.minute='2-digit';}
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(timestamp));
}
function elapsed(value: string, now: number): string {
  const date = tvDateTimestamp(value);
  if (date === null || !Number.isFinite(date) || date > now) return 'Entrada a verificar';
  const minutes = Math.floor((now - date) / 60000);
  if (minutes < 60) return `${minutes} min em aberto`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}min em aberto` : `${Math.floor(hours / 24)}d ${hours % 24}h em aberto`;
}
function isLate(order: ApoioReportRow, now: number): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(order.previsao || '')) return tvDeadlineState(order.previsao, new Date(now)) === 'overdue';
  const timestamp = tvDateTimestamp(order.previsao);
  return timestamp !== null && Number.isFinite(timestamp) && timestamp < now;
}
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export default function TVMonitor(props: TVMonitorProps) {
  const [config, setConfig] = useState<MonitorConfig>(readConfig);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [activePanel,setActivePanel] = useState<TVPanel>(props.initialPanel || 'emergency');
  const [panelPages,setPanelPages] = useState({emergency:0,external:0});
  const [nativeFullscreen,setNativeFullscreen] = useState(false);
  const [boardSpace,setBoardSpace] = useState({width:0,height:0});
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(config.seconds);
  const [clock, setClock] = useState(Date.now());
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const monitorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isExternal = activePanel === 'external';
  const filters = isExternal ? config.externalFilters : config.filters;
  const cycleActive = config.alternate && (presenting || nativeFullscreen);
  const intervalSeconds = cycleActive ? config.screenSeconds : config.seconds;
  const page = panelPages[activePanel];
  const setPage = (next: number) => setPanelPages(current => ({...current,[activePanel]:next}));
  useEffect(() => { if(props.initialPanel) {setActivePanel(props.initialPanel);setDetailKey(null);setFiltersOpen(false);} },[props.initialPanel]);
  useEffect(() => {const fullscreen=()=>setNativeFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',fullscreen);return()=>document.removeEventListener('fullscreenchange',fullscreen);},[]);
  useLayoutEffect(() => {
    const element=boardViewportRef.current; if(!element)return;
    let frame=0;
    const measure=()=>{ cancelAnimationFrame(frame); frame=requestAnimationFrame(()=>{const width=element.clientWidth,height=element.clientHeight;setBoardSpace(old=>old.width===width && old.height===height ? old : {width,height});}); };
    const observer=typeof ResizeObserver==='undefined' ? null : new ResizeObserver(measure);observer?.observe(element);
    setBoardSpace(old=>old.width===element.clientWidth && old.height===element.clientHeight ? old : {width:element.clientWidth,height:element.clientHeight});
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    return()=>{observer?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);};
  },[presenting,nativeFullscreen]);
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(config)); } catch {} }, [config]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const allPanels = useMemo(() => ({
    emergency:selectTVOrders(props.data,config.filters,new Date(clock)),
    external:selectTVExternalOrders(props.data,config.externalFilters,new Date(clock)),
  }),[props.data,config.filters,config.externalFilters,Math.floor(clock/60000)]);
  const rows = allPanels[activePanel];
  const eligible = useMemo(() => isExternal
    ? selectTVExternalOrders(props.data,externalDefaults,new Date(clock))
    : selectTVOrders(props.data,{...defaultTVFilters,groups:[]},new Date(clock)),[props.data,isExternal,Math.floor(clock/60000)]);
  const isPresentation=presenting || nativeFullscreen;
  const layoutFor=(count:number)=>getTVLayout(boardSpace.width,boardSpace.height,count,config.pageSize,isPresentation);
  const emergencyLayout=layoutFor(allPanels.emergency.length),externalLayout=layoutFor(allPanels.external.length);
  const layout=isExternal ? externalLayout : emergencyLayout;
  const pageSize=layout.pageSize;
  const previousSizes=useRef({emergency:emergencyLayout.pageSize,external:externalLayout.pageSize});
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));
  const actualPage=Math.min(page,pages-1);
  const shown=rows.slice(actualPage*pageSize,(actualPage+1)*pageSize);
  const gridRows=Math.max(1,Math.ceil(shown.length/layout.columns));
  const cellHeight=isPresentation ? (boardSpace.height-(gridRows-1)*10)/gridRows : 340;
  const density=cellHeight>=340 ? 'comfortable' : cellHeight>=280 ? 'compact' : 'dense';
  const detail=detailKey ? rows.find(row=>row.chave===detailKey) : null;
  useEffect(()=>{setPanelPages(c=>({...c,emergency:0}));},[config.filters]);
  useEffect(()=>{setPanelPages(c=>({...c,external:0}));},[config.externalFilters]);
  useEffect(()=>{
    const old=previousSizes.current,next={emergency:emergencyLayout.pageSize,external:externalLayout.pageSize};
    setPanelPages(current=>{
      const emergency=Math.min(Math.floor(current.emergency*old.emergency/next.emergency),Math.max(0,Math.ceil(allPanels.emergency.length/next.emergency)-1));
      const external=Math.min(Math.floor(current.external*old.external/next.external),Math.max(0,Math.ceil(allPanels.external.length/next.external)-1));
      return current.emergency===emergency && current.external===external ? current : {emergency,external};
    });
    previousSizes.current=next;
  },[emergencyLayout.pageSize,externalLayout.pageSize,allPanels.emergency.length,allPanels.external.length]);
  useEffect(()=>{setCountdown(intervalSeconds);},[activePanel,intervalSeconds,config.rotate,filtersOpen,detailKey,filters]);
  useEffect(()=>{
    if(!config.rotate || (!cycleActive && pages<=1) || filtersOpen || detailKey || props.loading)return;
    const timer=window.setTimeout(()=>{
      if(countdown<=1){
        if(cycleActive){
          // Cada visita continua de onde parou: nenhuma lista longa fica presa na primeira página.
          setPanelPages(c=>({...c,[activePanel]:(actualPage+1)%pages}));
          setActivePanel(isExternal ? 'emergency' : 'external');
        }else setPage((actualPage+1)%pages);
        setCountdown(intervalSeconds);
      }else setCountdown(countdown-1);
    },1000);
    return()=>clearTimeout(timer);
  },[countdown,config.rotate,cycleActive,pages,actualPage,activePanel,filtersOpen,detailKey,props.loading,intervalSeconds]);
  useEffect(() => {
    if (presenting) { const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = old; }; }
  }, [presenting]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (detailKey) setDetailKey(null); else if (filtersOpen) setFiltersOpen(false); else setPresenting(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detailKey, filtersOpen]);
  useEffect(() => {
    if (!detailKey && !filtersOpen) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus(), 0);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex="0"]') || []);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', trap); returnTo?.isConnected && returnTo.focus(); };
  }, [detailKey, filtersOpen]);
  const patch = (value: Partial<TVFilters>) => setConfig(c => isExternal ? ({...c,externalFilters:{...c.externalFilters,...value,location:'Oficina Externa',emergencyOnly:false}}) : ({...c,filters:{...c.filters,...value}}));
  const groups = props.data?.groups || [];
  const groupCounts = new Map<string, number>();
  const fleets = new Map((props.data?.fleets || []).map(f => [f.frota, f]));
  eligible.forEach(row => { const group = fleets.get(row.frota)?.grupo_id || ''; groupCounts.set(group, (groupCounts.get(group) || 0) + 1); });
  const sourceTime = props.data?.sync?.fonte_atualizada;
  const sourceTimestamp = sourceTime ? Date.parse(sourceTime) : NaN;
  const sourceMinutes = Number.isFinite(sourceTimestamp) ? Math.floor((clock - sourceTimestamp) / 60000) : null;
  const sourceBad = sourceMinutes === null || sourceMinutes > 75 || sourceMinutes < -5;
  const delayed = sourceMinutes !== null && sourceMinutes > 5;
  const syncError = props.error || props.data?.sync?.erro || '';
  const safeLive = props.connection === 'live' && !sourceBad && !syncError;
  const connectionLabel = props.connection === 'offline' ? 'Sem conexão' : syncError ? 'Falha de atualização' : sourceBad ? 'Fonte desatualizada' : delayed ? 'Fonte com atraso' : safeLive ? 'Conectado ao monitor' : props.connection === 'connecting' ? 'Conectando' : 'Consulta periódica';
  const pending = rows.filter(row => isLate(row, clock)).length;
  const unknownClass = (props.data?.orders || []).filter(o => o.ativo && fleets.has(o.frota) && !o.classe?.trim()).length;
  const sources = (props.data?.orders || []).filter(o => o.ativo && fleets.has(o.frota));
  const activeFilters = filters.groups.length + ['query', 'location', 'provider', 'sector', 'reason'].filter(k => Boolean(filters[k as keyof TVFilters])).length + (filters.minDays ? 1 : 0);
  const scope = `${isExternal ? 'Somente oficinas externas · Todas as classes' : filters.emergencyOnly ? 'Emergenciais' : 'Todas as classes'} · ${filters.status === 'Andamento' ? 'Em andamento' : 'Ordens abertas'}`;
  const groupSummary = !filters.groups.length ? 'Todas as categorias do Apoio' : filters.groups.map(id => groups.find(g => g.id === id)?.nome || (id === '__none__' ? 'Nenhuma categoria selecionada' : 'Categoria indisponível')).join(' · ');
  const fullscreen = async () => {
    setNotice('');
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await monitorRef.current?.requestFullscreen(); }
    catch { setNotice('Tela cheia indisponível neste navegador. Use Apresentar na TV para ocultar o menu.'); }
  };
  const nextPage = (delta: number) => { setPage((actualPage + delta + pages) % pages); setCountdown(intervalSeconds); };
  const fleetFont=(value:string)=>{
    const cardWidth=(boardSpace.width-Math.max(0,layout.columns-1)*10)/layout.columns;
    const inset=density==='comfortable'?14:density==='compact'?11:10;
    const gap=density==='dense'?8:12;
    const track=Math.max(1,(cardWidth-2-inset*2-gap)*.47);
    const maximum=density==='dense'?36:density==='compact'?44:56;
    return Math.max(10,Math.min(maximum,Math.floor(track/(Math.max(1,String(value).length)*.72))));
  };
  const board = <div ref={monitorRef} className={`tv-monitor ${presenting ? 'tv-monitor--presenting' : ''}`} data-page-size={pageSize} data-density={density} data-columns={layout.columns} style={{'--tv-columns':layout.columns,'--tv-grid-rows':gridRows} as React.CSSProperties} data-tv-theme={config.theme} data-panel={activePanel}>
    {isPresentation && <AmbientBrandWatermark variant="tv" />}
    <header className="tv-topbar">
      <div className="tv-brand"><img src="/logo.png" alt="Branco Peres Agro"/><div><span className="tv-eyebrow">Centro de acompanhamento · Gerência</span><h2>{isExternal ? 'Ordens externas do Apoio' : 'Monitor de emergências'}<span className="tv-title-dot"/></h2><p>{scope}</p></div></div>
      <div className="tv-topbar-right"><span className={`tv-connection ${sourceBad || syncError || props.connection === 'offline' || delayed || props.connection === 'polling' ? 'is-warning' : ''}`}><span/>{connectionLabel}</span><time>{new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(clock)}<small>Brasília</small></time></div>
    </header>
    <nav className="tv-board-tabs" aria-label="Painéis do Modo TV">
      <button aria-label="Painel Emergenciais" aria-pressed={!isExternal} onClick={()=>setActivePanel('emergency')}><AlertTriangle size={16}/>Emergenciais <b>{allPanels.emergency.length}</b></button>
      <button aria-label="Painel Ordens Externas" aria-pressed={isExternal} onClick={()=>setActivePanel('external')}><Building2 size={16}/>Ordens externas <b>{allPanels.external.length}</b></button>
      <span className="tv-cycle-info">{cycleActive ? config.rotate && !filtersOpen && !detailKey ? `Próximo painel em ${countdown}s · ${isExternal ? 'Emergenciais' : 'Externas'}` : 'Alternância pausada' : 'Apresente na TV para alternar os dois painéis'}</span>
    </nav>
    <div className="tv-commandbar"><div className="tv-selected-scope"><Filter size={15}/><span>{groupSummary}</span></div><div className="tv-controls">
      <button ref={triggerRef} onClick={() => setFiltersOpen(true)} aria-label="Configurar filtros do monitor"><Settings2 size={16}/>Filtros{activeFilters > 0 && <b>{activeFilters}</b>}</button>
      <button disabled={props.refreshing} onClick={() => void props.refresh()} aria-label="Atualizar monitor"><RefreshCw size={16} className={props.refreshing ? 'animate-spin' : ''}/><span>Atualizar</span></button>
      <button onClick={()=>setConfig(c=>({...c,theme:c.theme==='dark'?'light':'dark'}))} aria-label={config.theme==='dark'?'Ativar modo claro premium':'Ativar modo escuro premium'}>{config.theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}<span>{config.theme==='dark'?'Claro premium':'Escuro premium'}</span></button>
      <button onClick={() => setPresenting(!presenting)} aria-label={presenting ? 'Sair da apresentação TV' : 'Apresentar na TV'}><Monitor size={16}/><span>{presenting ? 'Sair da TV' : 'Apresentar na TV'}</span></button>
      <button onClick={() => void fullscreen()} aria-label="Alternar tela cheia"><Maximize2 size={16}/></button>
    </div></div>
    {(syncError || sourceBad || delayed || notice) && !props.loading && <div className={`tv-warning ${sourceBad || syncError ? 'is-critical' : ''}`} role="status"><AlertTriangle size={16}/><span>{notice || syncError || (sourceMinutes === null ? 'A fonte ainda não informou uma atualização válida.' : sourceMinutes < -5 ? 'Horário da fonte inconsistente.' : `Fonte atualizada há ${sourceMinutes} min. Verifique a atualização do PIMS.`)}{syncError && props.data ? ' Última fotografia preservada; as ordens podem estar desatualizadas.' : ''}</span></div>}
    {!isExternal && (!filters.emergencyOnly || filters.status !== 'Andamento') ? <div className="tv-scope-warning">Escopo ampliado: {scope}. Este monitor não está restrito às emergências em andamento.</div> : null}
    <section className="tv-summary" aria-label="Resumo da seleção"><div><span>Ordens monitoradas</span><strong>{rows.length.toString().padStart(2,'0')}</strong><small>Na seleção atual</small></div><div><span>Frotas envolvidas</span><strong>{new Set(rows.map(r => r.frota)).size.toString().padStart(2,'0')}</strong><small>Equipamentos do Apoio</small></div><div className={pending ? 'tv-summary-alert' : ''}><span>Previsões vencidas</span><strong>{pending.toString().padStart(2,'0')}</strong><small>Prazo informado na fonte</small></div><div className="tv-summary-source"><span>Atualização da fonte</span><strong>{sourceTime ? dateText(sourceTime) : 'Aguardando'}</strong><small>{sourceMinutes === null ? 'Sem horário válido' : sourceMinutes < 0 ? 'Horário a verificar' : sourceMinutes === 0 ? 'Neste minuto' : `Há ${sourceMinutes} min`} · PIMS</small></div></section>
    <div className="tv-board-viewport" ref={boardViewportRef}><section className="tv-board" aria-label="Ordens monitoradas" key={`${activePanel}-${actualPage}-${pageSize}`}>
      {props.loading && !props.data ? <div className="tv-empty"><RefreshCw className="animate-spin" size={32}/><h3>Carregando o monitor</h3><p>Consultando as ordens compartilhadas do Apoio.</p></div> : !shown.length ? <div className="tv-empty"><Activity size={36}/><h3>{props.data ? 'Nenhuma ordem nesta seleção' : 'Não foi possível carregar as ordens'}</h3><p>{props.data ? 'Não há ordens que atendam simultaneamente aos filtros. O monitor continua acompanhando novas atualizações.' : 'Verifique a conexão e a instalação do Apoio no Supabase.'}</p>{unknownClass > 0 && !isExternal && filters.emergencyOnly && <p className="tv-empty-note">{unknownClass} ordem(ns) sem classe na fonte/banco. Não serão classificadas como emergenciais por suposição. Confira a integração PCM.</p>}<button onClick={() => setFiltersOpen(true)}>Revisar filtros</button></div> : shown.map(order => <article className={`tv-order ${isLate(order,clock) ? 'tv-order--late' : ''} ${isEmergencyOrder(order) ? 'tv-order--emergency' : ''}`} key={order.chave} style={{'--tv-fleet-digits':Math.max(1,String(order.frota).length)} as React.CSSProperties}>
        <div className="tv-order-top">{isExternal && <span className="tv-external">EXTERNA</span>}<span className={isEmergencyOrder(order) ? 'tv-emergency' : 'tv-class'}>{isEmergencyOrder(order) && <AlertTriangle size={13}/>} {isEmergencyOrder(order) ? 'EMERGENCIAL' : order.classe || 'Classe não informada'}</span><span className="tv-order-status"><span/>{order.status}</span></div>
        <div className="tv-equipment"><div><span className="tv-fleet-label">Frota</span><strong style={{fontSize:fleetFont(order.frota)}}>{order.frota}</strong></div><div className="tv-equipment-name"><div className="tv-equipment-identity"><EquipmentThumbnail equipment={order} size="hero" /><div><span>{order.apoio}</span><h3 title={order.equipamento}>{order.equipamento}</h3><p>OS {order.os}</p></div></div></div></div>
        <div className="tv-order-location"><Building2 size={16}/><div><strong>{oficinaLabel(order.origem) === 'Oficina Externa' ? order.prestador || 'Prestador não informado' : oficinaLabel(order.origem)}</strong><span>{order.setor || 'Setor não informado'} · {order.ponto || 'Ponto não informado'}</span></div></div>
        <div className="tv-order-problem"><span>{order.motivo || 'Motivo não informado'}</span><p>{order.narrativa || 'Narrativa não informada na fonte.'}</p></div>
        <div className="tv-order-dates"><div><span>Entrada</span><strong>{dateText(order.entrada)}</strong></div><div className={isLate(order,clock) ? 'is-late' : ''}><span>{isLate(order,clock) ? 'Previsão vencida' : 'Previsão de saída'}</span><strong>{dateText(order.previsao)}</strong></div></div>
        <footer><span><Clock3 size={12}/>{elapsed(order.entrada,clock)}</span><button onClick={() => setDetailKey(order.chave)} aria-label={`Ver ordem ${order.os} da frota ${order.frota}`}>Ver ordem completa<ChevronRight size={13}/></button></footer>
      </article>)}
    </section></div>
    <footer className="tv-pagination"><div><span className="tv-foot-label">Acompanhamento do Apoio</span><small>{props.lastReadAt ? `Última leitura ${dateText(typeof props.lastReadAt === 'number' ? new Date(props.lastReadAt).toISOString() : props.lastReadAt)}` : 'Aguardando leitura'} · Realtime + verificação a cada 30s</small></div><div className="tv-page-controls"><button onClick={() => nextPage(-1)} disabled={pages <= 1} aria-label="Página anterior"><ChevronLeft size={17}/></button><span>Página <b>{actualPage + 1}</b> de {pages}<small>{rows.length ? `${actualPage * pageSize + 1}–${Math.min((actualPage + 1) * pageSize,rows.length)} de ${rows.length} ordens` : '0 ordens'}</small></span><button onClick={() => nextPage(1)} disabled={pages <= 1} aria-label="Próxima página"><ChevronRight size={17}/></button><button className="tv-rotation" onClick={() => setConfig(c => ({...c,rotate:!c.rotate}))} aria-label={config.rotate ? 'Pausar rodízio' : 'Iniciar rodízio'}>{config.rotate ? <Pause size={14}/> : <Play size={14}/>}<span>{config.rotate && (cycleActive || pages > 1) ? `${countdown}s` : config.rotate ? 'Automático' : 'Pausado'}</span></button></div></footer>
  </div>;
  const overlay = (filtersOpen || detailKey) ? createPortal(<div className="tv-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setFiltersOpen(false); setDetailKey(null); } }}><div className="tv-dialog" data-tv-theme={config.theme} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tv-dialog-title"><header><div><span className="tv-eyebrow">Monitor gerencial</span><h2 id="tv-dialog-title">{filtersOpen ? 'Configurar acompanhamento' : detail ? `Frota ${detail.frota} · OS ${detail.os}` : 'Ordem fora da seleção'}</h2></div><button onClick={() => {setFiltersOpen(false);setDetailKey(null);}} aria-label="Fechar painel"><X size={20}/></button></header>
    {filtersOpen ? <div className="tv-filter-content"><p className="tv-filter-intro">Selecione as categorias e combine os filtros. A configuração fica salva neste navegador, sem alterar as ordens.</p><div className="tv-filter-scope"><label>Classe<select aria-label="Classe" disabled={isExternal} value={filters.emergencyOnly ? 'emergency' : 'all'} onChange={e => patch({emergencyOnly:e.target.value === 'emergency'})}><option value="emergency">Somente emergenciais</option><option value="all">Todas as classes — ampliar escopo</option></select></label><label>Situação<select aria-label="Situação" value={filters.status} onChange={e => patch({status:e.target.value as TVFilters['status']})}><option value="Andamento">Somente em andamento</option><option value="abertas">Todas as abertas — ampliar escopo</option></select></label></div>
      <section className="tv-filter-groups"><div><h3>Categorias do Apoio</h3><div><button onClick={() => patch({groups:[]})}>Todas</button><button onClick={() => patch({groups:['__none__']})}>Nenhuma</button></div></div><div className="tv-category-grid">{groups.map(group => <label className={!filters.groups.length || filters.groups.includes(group.id) ? 'is-selected' : ''} key={group.id}><input type="checkbox" checked={!filters.groups.length || filters.groups.includes(group.id)} onChange={e => { const selected = !filters.groups.length ? groups.map(g => g.id) : filters.groups.filter(g => g !== '__none__'); const next = e.target.checked ? [...new Set([...selected,group.id])] : selected.filter(id => id !== group.id); patch({groups:next.length ? next : ['__none__']}); }}/><span>{group.nome}</span><b>{groupCounts.get(group.id) || 0}</b></label>)}</div><small>Contadores: {isExternal ? 'ordens externas abertas' : 'emergenciais em andamento'}, antes dos demais filtros.</small></section>
      <label className="tv-search"><span><Search size={15}/> Buscar frota, OS, equipamento ou narrativa</span><input aria-label="Buscar frota, OS, equipamento ou narrativa" value={filters.query} onChange={e => patch({query:e.target.value})} placeholder="Ex.: 4508, motor, número da OS"/></label>
      <div className="tv-filter-fields"><label>Origem / oficina<select aria-label="Origem / oficina" disabled={isExternal} value={filters.location} onChange={e => patch({location:e.target.value})}><option value="">Todas as origens</option>{unique(sources.map(o => oficinaLabel(o.origem))).map(v => <option key={v}>{v}</option>)}</select></label><label>Prestador externo<select aria-label="Prestador externo" value={filters.provider} onChange={e => patch({provider:e.target.value})}><option value="">Todos os prestadores</option>{unique(sources.filter(o => oficinaLabel(o.origem)==='Oficina Externa').map(o => o.prestador || 'Não informado')).map(v => <option key={v}>{v}</option>)}</select></label><label>Setor<select aria-label="Setor" value={filters.sector} onChange={e => patch({sector:e.target.value})}><option value="">Todos os setores</option>{unique(sources.map(o => o.setor)).map(v => <option key={v}>{v}</option>)}</select></label><label>Motivo<select aria-label="Motivo" value={filters.reason} onChange={e => patch({reason:e.target.value})}><option value="">Todos os motivos</option>{unique(sources.map(o => o.motivo || '')).map(v => <option key={v}>{v}</option>)}</select></label><label>Tempo mínimo em aberto<select aria-label="Tempo mínimo em aberto" value={filters.minDays} onChange={e => patch({minDays:Number(e.target.value)})}>{[0,1,3,7,15,30].map(v => <option value={v} key={v}>{v ? `${v} dia(s) ou mais` : 'Qualquer duração'}</option>)}</select></label><label>Ordenação<select aria-label="Ordenação" value={filters.sort} onChange={e => patch({sort:e.target.value as TVFilters['sort']})}><option value="oldest">Entrada mais antiga</option><option value="newest">Entrada mais recente</option><option value="fleet">Número de frota</option><option value="deadline">Previsão mais próxima</option></select></label></div>
      <section className="tv-filter-playback"><h3>Apresentação na TV</h3><div className="tv-filter-fields"><label>Ordens por página<select aria-label="Ordens por página" value={config.pageSize} onChange={e => setConfig(c => ({...c,pageSize:Number(e.target.value)}))}><option value={0}>Automático — adapta à quantidade</option><option value={4}>4 — destaque máximo</option><option value={6}>6 — equilibrado</option><option value={8}>8 — compacto</option><option value={12}>12 — maior densidade</option></select></label><label>Intervalo do rodízio<select aria-label="Intervalo do rodízio" value={config.seconds} onChange={e => setConfig(c => ({...c,seconds:Number(e.target.value)}))}>{[10,20,30,60].map(v => <option key={v} value={v}>{v} segundos</option>)}</select></label><label>Alternância dos painéis<select aria-label="Alternância dos painéis" value={config.alternate?'on':'off'} onChange={e=>setConfig(c=>({...c,alternate:e.target.value==='on'}))}><option value="on">Emergenciais + Externas na TV</option><option value="off">Somente o painel escolhido</option></select></label><label>Tempo por painel<select aria-label="Tempo por painel" value={config.screenSeconds} onChange={e=>setConfig(c=>({...c,screenSeconds:Number(e.target.value)}))}>{[5,10,12,15,20,30,60].map(v=><option key={v} value={v}>{v} segundos</option>)}</select></label><label>Aparência<select aria-label="Aparência do monitor" value={config.theme} onChange={e=>setConfig(c=>({...c,theme:e.target.value as MonitorConfig['theme']}))}><option value="dark">Escuro premium</option><option value="light">Claro premium</option></select></label></div><p className="tv-filter-intro">Na TV, alterna os painéis e avança suas páginas independentemente. Filtros e detalhes pausam a alternância. O layout usa o espaço real da tela. A quantidade por página é reduzida automaticamente quando necessário, inclusive nas opções manuais, sem perder ordens no rodízio.</p></section>
      <div className="tv-filter-footer"><button onClick={() => {setConfig(baseConfig());}}>Restaurar padrão</button><button className="tv-primary" onClick={() => setFiltersOpen(false)}>Concluir · {rows.length} ordem(ns)</button></div></div> : detail ? <div className="tv-detail-content"><div className="tv-detail-tags"><span className={isEmergencyOrder(detail) ? 'tv-emergency' : 'tv-class'}>{detail.classe || 'Classe não informada'}</span><span>{detail.status}</span><span>{detail.apoio}</span></div><h3>{detail.equipamento}</h3><dl><div><dt>Oficina / origem</dt><dd>{oficinaLabel(detail.origem)}{detail.prestador ? ` · ${detail.prestador}` : ''}</dd></div><div><dt>Setor / ponto</dt><dd>{detail.setor} · {detail.ponto}</dd></div><div><dt>Motivo</dt><dd>{detail.motivo || 'Não informado'}</dd></div><div><dt>Entrada</dt><dd>{dateText(detail.entrada)} · {elapsed(detail.entrada,clock)}</dd></div><div><dt>Previsão de saída</dt><dd>{dateText(detail.previsao)}{isLate(detail,clock) ? ' · PREVISÃO VENCIDA' : ''}</dd></div></dl><h4>Narrativa integral da ordem</h4><p>{detail.narrativa || 'Não informada na fonte.'}</p></div> : <div className="tv-detail-content"><p>Esta ordem saiu da seleção após uma atualização. Ela pode ter mudado de situação, classe ou presença na fonte; isso não comprova sua conclusão.</p></div>}
  </div></div>,document.fullscreenElement || document.body) : null;
  return <>{presenting ? createPortal(board, document.body) : board}{overlay}</>;
}
