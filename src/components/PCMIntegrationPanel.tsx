import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Save, Search } from 'lucide-react';
import { classifyPCMOrder, loadPCMReview, type PCMClassification, type PCMReviewData, type PCMReviewOrder } from '../lib/pcmService';
import { syncApoio } from '../lib/apoioService';
import { isNavigatorOnline, isPageVisible } from '../lib/egressCachePolicy';
import { isHiddenLavagemEquipment } from '../lib/lavagemEquipmentScope';

const box: React.CSSProperties = { border: '1px solid var(--border-primary)', borderRadius: 16, background: 'var(--bg-card)', color: 'var(--text-primary)' };
const muted: React.CSSProperties = { color: 'var(--text-secondary)' };
const field: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', minWidth: 0 };
const button = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40';
const green: React.CSSProperties = { background: 'var(--brand-green)', color: '#10231d' };
const neutral: React.CSSProperties = { background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' };
const timestamp = (value: string | null | undefined) => {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Verificar data';
};
const isIgnored = (order: PCMReviewOrder) => order.tipo_atual === 'IGNORAR' || order.regra === 'IGNORAR' || order.regra.startsWith('ignorar_');
const isReview = (order: PCMReviewOrder) => !isIgnored(order) && (Boolean(order.motivo_revisao) || !order.tipo_atual);

export default function PCMIntegrationPanel({ onChanged, hideMainEquipment = false }: { onChanged: () => void; hideMainEquipment?: boolean }) {
  const [data, setData] = useState<PCMReviewData | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'revisar' | 'todas'>('revisar');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, PCMClassification>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const inFlight = useRef(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async (consult = false, force = consult) => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    let syncError = '';
    try {
      if (consult) { try { await syncApoio({ force: true }); } catch (err) { syncError = err instanceof Error ? err.message : String(err); } }
      const next = await loadPCMReview({ force });
      if (alive.current) { setData(next); setError(syncError); }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : String(err)); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; void refresh(false, false);
    const maybeAutoRefresh = () => {
      if (!isPageVisible() || !isNavigatorOnline()) return;
      void refresh(false, false);
    };
    const timer = window.setInterval(maybeAutoRefresh, 3 * 60_000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { setPage(1); }, [scope, query]);

  const equipmentRows = useMemo(() => (data?.rows || []).filter(row => !hideMainEquipment || !isHiddenLavagemEquipment({frota:row.frota,apoioNome:row.apoio})), [data, hideMainEquipment]);
  const pending = equipmentRows.filter(isReview).length;
  const selected = useMemo(() => equipmentRows.filter(order => {
    if (scope === 'revisar' && !isReview(order)) return false;
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return !search || [order.frota, order.os, order.apoio, order.equipamento, order.narrativa, order.tipo_atual].some(value => value?.toLocaleLowerCase('pt-BR').includes(search));
  }), [equipmentRows, scope, query]);
  const actualPage = Math.min(page, Math.max(1, Math.ceil(selected.length / 15)));
  const shown = selected.slice((actualPage - 1) * 15, actualPage * 15);
  const sourceDate = data?.sync?.fonte_atualizada;
  const age = sourceDate ? (Date.now() - Date.parse(sourceDate)) / 60_000 : Infinity;
  const stale = !Number.isFinite(age) || age > 75 || age < -5;

  const save = async (order: PCMReviewOrder) => {
    const choice = drafts[order.chave];
    if (!choice || busy) return;
    if (choice === 'IGNORAR' && !window.confirm(`Retirar a OS ${order.os} da programação automática? Seu histórico será preservado e a ordem continuará no Gestão de Ordens.`)) return;
    setBusy(order.chave); setError(''); setNotice('');
    try {
      await classifyPCMOrder(order.chave, choice);
      setNotice(`OS ${order.os}: classificação salva e compartilhada.`);
      setDrafts(current => { const next = { ...current }; delete next[order.chave]; return next; });
      await refresh(false, true); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(''); }
  };

  return <section className="p-4 mb-4 space-y-3" style={{ ...box, background: 'linear-gradient(115deg, rgba(31,107,69,.18), var(--bg-card))' }}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-bold">Programação automática · PCM → Apoio</h3><p className="text-xs mt-1" style={muted}>Somente frotas cadastradas no Apoio. Lavagem/Lubrificação e Troca de Óleo são controles separados por OS.</p></div>
      <div className="flex flex-wrap gap-2"><button className={button} style={neutral} disabled={loading || Boolean(busy)} onClick={() => { void refresh(true, true).then(onChanged); }}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Consultando…' : 'Consultar PCM'}</button><button className={button} style={green} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}Revisar classificação{pending > 0 ? ` · ${pending}` : ''}</button></div>
    </div>
    <p className="text-xs" style={muted}>Dados do PCM: {timestamp(sourceDate)} · Consulta econômica automática a cada 3 min com aba ativa.</p>
    <p className="text-xs" style={muted}>A Entrada define a programação. A saída de uma listagem válida encerra automaticamente o controle, com data de detecção no histórico — não preenche uma data de execução desconhecida.</p>
    {data && (stale || data.sync?.erro) && <p className="text-xs p-3 rounded-lg flex gap-2" style={{ background: 'rgba(217,119,6,.12)', color: '#b7791f' }}><AlertTriangle size={16} className="shrink-0" />Atualização pendente. As últimas programações válidas são preservadas; falhas e dados antigos não encerram ordens.</p>}
    {error && <p role="alert" className="text-xs text-red-500 break-words">{error}</p>}
    {notice && <p role="status" className="text-xs" style={{ color: 'var(--brand-green)' }}>{notice}</p>}
    {open && <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
      <div className="flex flex-wrap items-center gap-2"><button className={button} style={scope === 'revisar' ? green : neutral} onClick={() => setScope('revisar')}>Precisa revisar · {pending}</button><button className={button} style={scope === 'todas' ? green : neutral} onClick={() => setScope('todas')}>Todas as candidatas</button><label className="flex items-center gap-2 flex-1" style={muted}><Search size={15} /><input style={{ ...field, width: '100%' }} aria-label="Buscar classificação PCM" placeholder="Frota, OS ou grupo Apoio" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <p className="text-xs" style={muted}>Códigos de plano terminados em LUB identificam troca de óleo, independentemente do número (ex.: 302LUB e 20.004LUB). O setor Lavador/Lubrificação sozinho não define o serviço. Preventivas sem identificação precisam de revisão. Uma exceção fica vinculada à OS, sem alterar a ordem no PIMS.</p>
      {shown.map(order => <article key={order.chave} className="p-3 space-y-3 rounded-xl" style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}>
        <div className="flex flex-wrap justify-between gap-2"><div><strong className="text-sm">Frota {order.frota} · OS {order.os}</strong><p className="text-xs mt-1" style={muted}>{order.apoio} · {order.equipamento}</p></div><strong className="text-xs" style={{ color: 'var(--brand-green)' }}>{isIgnored(order) ? 'Retirada da programação' : order.tipo_atual || 'Classificação pendente'}</strong></div>
        <p className="text-xs" style={muted}>{order.setor} · {order.ponto} · Motivo: {order.motivo || 'Não informado'} · Classe: {order.classe || 'Não informada'}</p>
        <p className="text-xs" style={muted}>Entrada: {timestamp(order.entrada)} · Previsão: {timestamp(order.previsao)}</p>
        <p className="text-xs whitespace-pre-wrap break-words">{order.narrativa || 'Sem narrativa'}</p>
        {order.motivo_revisao && <p className="text-xs" style={{ color: '#b7791f' }}>{order.motivo_revisao}</p>}
        <div className="flex flex-wrap items-center gap-2"><select aria-label={`Classificação da OS ${order.os}`} style={field} disabled={Boolean(busy)} value={drafts[order.chave] || ''} onChange={event => setDrafts(current => ({ ...current, [order.chave]: event.target.value as PCMClassification }))}><option value="">Selecionar classificação…</option><option value="AUTO">Voltar à regra automática</option><option>Lavagem / Lubrificação</option><option>Lubrificação</option><option>Troca de Óleo</option><option value="IGNORAR">Não incluir nesta programação</option></select><button className={button} style={green} disabled={!drafts[order.chave] || Boolean(busy)} onClick={() => { void save(order); }}><Save size={14} />{busy === order.chave ? 'Salvando…' : 'Salvar'}</button><span className="text-xs" style={muted}>Regra: {order.regra || 'Revisão necessária'}</span></div>
      </article>)}
      {!shown.length && <p className="text-sm py-3 text-center" style={muted}>{loading ? 'Carregando ordens…' : scope === 'revisar' ? 'Nenhuma ordem precisa de classificação nesta seleção.' : 'Nenhuma candidata encontrada. Confira o cadastro das frotas no Apoio.'}</p>}
      {selected.length > 15 && <div className="flex items-center justify-between text-xs"><span style={muted}>Página {actualPage} de {Math.ceil(selected.length / 15)} · {selected.length} ordens</span><div className="flex gap-2"><button className={button} style={neutral} disabled={actualPage <= 1} onClick={() => setPage(actualPage - 1)}>Anterior</button><button className={button} style={neutral} disabled={actualPage >= Math.ceil(selected.length / 15)} onClick={() => setPage(actualPage + 1)}>Próxima</button></div></div>}
    </div>}
  </section>;
}
