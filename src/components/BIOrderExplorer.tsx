import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ChevronDown, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { BIRow } from '../lib/managementAnalytics';
import { formatApoioDate } from '../lib/apoioDate';
import EquipmentThumbnail from './EquipmentThumbnail';

interface Props { rows: BIRow[]; selectionKey: string; }
const number = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const date = (value?: string | null) => value ? formatApoioDate(value) : '—';
const compareNumber = (a: number | null, b: number | null) => a === null ? (b === null ? 0 : 1) : b === null ? -1 : b - a;

export default function BIOrderExplorer({ rows, selectionKey }: Props) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState('waiting');
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setPage(1); setExpanded(null); }, [selectionKey]);
  const ordered = useMemo(() => [...rows].sort((a, b) => {
    let value = 0;
    if (sort === 'waiting') value = compareNumber(a.waitingDays, b.waitingDays);
    else if (sort === 'age') value = compareNumber(a.ageDays, b.ageDays);
    else if (sort === 'entry') value = b.openedDate.localeCompare(a.openedDate);
    else if (sort === 'group') value = a.apoio.localeCompare(b.apoio, 'pt-BR');
    else if (sort === 'os') value = a.os.localeCompare(b.os, 'pt-BR', { numeric: true });
    else value = a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true });
    return value || a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true }) || a.chave.localeCompare(b.chave);
  }), [rows, sort]);
  const pages = Math.max(1, Math.ceil(ordered.length / size));
  const actualPage = Math.min(page, pages);
  const shown = ordered.slice((actualPage - 1) * size, actualPage * size);
  return <section className="bi-panel bi-explorer" aria-labelledby="bi-order-title">
    <div className="bi-panel-heading"><div><span className="bi-eyebrow">CONSULTA ANALÍTICA</span><h2 id="bi-order-title">Ordens da seleção</h2><p>{rows.length.toLocaleString('pt-BR')} ordens · seleções dos gráficos e filtros aplicadas</p></div>
      <label className="bi-sort"><ArrowDownWideNarrow size={15} /><span className="sr-only">Ordenar ordens</span><select aria-label="Ordenar ordens" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="waiting">Maior idade em fila</option><option value="age">Maior idade aberta</option><option value="entry">Entrada mais recente</option><option value="fleet">Número de frota</option><option value="os">Número da OS</option><option value="group">Grupo de equipamento</option></select></label>
    </div>
    <div className="bi-table-scroll" role="region" aria-label="Tabela de ordens gerenciais; deslize para ver todas as colunas" tabIndex={0}>
      <table className="bi-orders-table"><thead><tr><th>Frota / OS</th><th>Grupo / Equipamento</th><th>Situação</th><th>Entrada</th><th>Idade da fila</th><th>Idade / ciclo</th><th>Previsão</th><th>Narrativa</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>
        {shown.map(row => <Fragment key={row.chave}><tr className={row.forecastOverdue ? 'bi-row-overdue' : ''}>
          <td><strong>{row.frota || 'Sem frota'}</strong><small>OS {row.os || 'Não informada'}</small></td><td><div className="bi-equipment-cell"><EquipmentThumbnail equipment={row} size="table" /><div><span>{row.apoio}</span><small>{row.equipamento || row.modelo || 'Não informado'}</small></div></div></td>
          <td><span className={`bi-status bi-status-${row.statusKey}`}>{row.statusName}</span>{!row.registered && <small className="bi-source-tag">Frota sem cadastro Apoio</small>}</td>
          <td>{date(row.entrada)}</td><td><strong className={row.waitingDays !== null && row.waitingDays > 30 ? 'bi-aged' : ''}>{number(row.waitingDays)}{row.waitingDays !== null ? ' d' : ''}</strong></td>
          <td>{number(row.statusKey === 'encerrado' ? row.observedCycleDays : row.ageDays)}{(row.statusKey === 'encerrado' ? row.observedCycleDays : row.ageDays) !== null ? ' d' : ''}<small>{row.statusKey === 'encerrado' ? 'Ciclo observado' : 'Desde a entrada'}</small></td>
          <td><span className={row.forecastOverdue ? 'bi-aged' : ''}>{date(row.previsao)}</span>{row.forecastOverdue && <small className="bi-aged">{number(row.forecastDaysLate)} d vencida</small>}</td>
          <td><span className="bi-narrative-preview" title={row.narrativa}>{row.narrativa || 'Sem narrativa'}</span></td>
          <td><button type="button" className="bi-detail-button" aria-label={`Detalhes da OS ${row.os || row.chave}`} aria-expanded={expanded === row.chave} onClick={() => setExpanded(current => current === row.chave ? null : row.chave)}><ChevronDown size={16} /></button></td>
        </tr>{expanded === row.chave && <tr className="bi-expanded-row"><td colSpan={9}><div className="bi-order-details">
          <div><h3><FileText size={16} />OS {row.os} · Frota {row.frota}</h3><p className="bi-full-narrative">{row.narrativa || 'Narrativa não informada.'}</p></div>
          <dl><div><dt>Grupo na fonte</dt><dd>{row.grupo_fonte || 'Não informado'}</dd></div><div><dt>Status bruto na fonte</dt><dd>{row.status || 'Não informado'}</dd></div><div><dt>Local / oficina</dt><dd>{row.workshop}</dd></div><div><dt>Prestador</dt><dd>{row.prestador || 'Não informado'}</dd></div><div><dt>Setor / ponto</dt><dd>{row.setor || '—'} / {row.ponto || '—'}</dd></div><div><dt>Classe / motivo</dt><dd>{row.classe || '—'} / {row.motivo || '—'}</dd></div><div><dt>Primeira / última presença</dt><dd>{date(row.primeira_vista)} / {date(row.ultima_vista)}</dd></div><div><dt>Encerramento</dt><dd>{row.closureType === 'ausencia' ? `Saída validada; detecção ${date(row.closedDetectedAt)}` : row.closureType === 'fonte' ? 'Status encerrado informado na fonte; não implica data de execução' : 'Sem encerramento comprovado'}</dd></div></dl>
          <p className="bi-detail-note">Idade da fila é tempo desde a entrada para a situação atual. Não representa espera líquida nem duração de reparo confirmado.</p>
        </div></td></tr>}</Fragment>)}
        {!shown.length && <tr><td colSpan={9} className="bi-table-empty">Nenhuma ordem corresponde à seleção. Ajuste a pesquisa ou limpe os filtros.</td></tr>}
      </tbody></table>
    </div>
    <div className="bi-pagination"><span>{ordered.length ? `${(actualPage - 1) * size + 1}–${Math.min(actualPage * size, ordered.length)} de ${ordered.length.toLocaleString('pt-BR')}` : '0 ordens'}</span><label>Por página <select aria-label="Ordens por página" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}><option>25</option><option>50</option><option>100</option></select></label><div><button type="button" aria-label="Página anterior de ordens" disabled={actualPage <= 1} onClick={() => setPage(actualPage - 1)}><ChevronLeft size={16} /></button><span>{actualPage} / {pages}</span><button type="button" aria-label="Próxima página de ordens" disabled={actualPage >= pages} onClick={() => setPage(actualPage + 1)}><ChevronRight size={16} /></button></div></div>
  </section>;
}
