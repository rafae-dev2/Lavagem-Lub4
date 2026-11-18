import { Fragment } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { formatApoioDate as formatDate } from '../lib/apoioDate';
import { apoioOrderStatusLabel } from '../lib/apoioFilters';
import { apoioForecastOverdue } from '../lib/apoioCardPresentation';
import { getMaintenanceOrderClosure } from '../lib/maintenanceTracking';
import { ApoioGroup, ApoioReportRow, oficinaLabel } from '../types/apoio';
import EquipmentThumbnail from './EquipmentThumbnail';

interface Props {
  rows: ApoioReportRow[];
  expanded: string | null;
  onToggle: (key: string) => void;
  groups?: ApoioGroup[];
  groupIdForFleet?: (frota: string) => string;
  busy?: boolean;
  onAssign?: (row: ApoioReportRow, groupId: string) => void;
}

function rawStatus(row: ApoioReportRow): string {
  return row.status?.trim() || 'Não informado';
}

function statusClass(status: ReturnType<typeof getMaintenanceOrderClosure>['status']): string {
  switch (status) {
    case 'encerrado': return 'closed';
    case 'andamento': return 'progress';
    case 'programado': return 'scheduled';
    case 'ausente': return 'unconfirmed';
    default: return 'other';
  }
}

function closureOriginLabel(origin: 'fonte' | 'ausencia' | null): string {
  if (origin === 'ausencia') return 'Ausência validada';
  if (origin === 'fonte') return 'Status informado pela fonte';
  return 'Não se aplica';
}

function localDetail(row: ApoioReportRow): string {
  const local = oficinaLabel(row.origem);
  if (local === 'Oficina Externa') return row.prestador || 'Prestador não informado';
  return [row.setor, row.ponto].filter(Boolean).join(' · ') || 'Ponto não informado';
}

function fleetLabel(row: ApoioReportRow): string {
  return row.frota === 'SEM-FROTA' ? 'Não informada' : row.frota;
}

function detailId(key: string, index: number): string {
  const encoded = encodeURIComponent(key).replace(/%/g, '-');
  return `apoio-table-detail-${encoded}-${index}`;
}

function closureNote(row: ApoioReportRow, closure: ReturnType<typeof getMaintenanceOrderClosure>): string | null {
  if (closure.status === 'encerrado') {
    const detected = closure.detectedAt ? formatDate(closure.detectedAt) : 'não informada';
    return closure.origin === 'ausencia'
      ? `Ausência validada em ${detected}; a execução humana não é inferida.`
      : `Encerramento informado pela fonte; detecção em ${detected}. A execução humana não é inferida.`;
  }
  if (closure.status === 'ausente') {
    return `A ordem não consta mais na fonte desde ${formatDate(row.ausente_desde)}. Isso não confirma finalização.`;
  }
  return null;
}

export default function ApoioOrdersTable({
  rows,
  expanded,
  onToggle,
  groups = [],
  groupIdForFleet = () => '',
  busy = false,
  onAssign,
}: Props) {
  return (
    <div className="apoio-table-scroll" tabIndex={0} role="region" aria-label="Tabela de ordens Apoio — use as setas para rolar horizontalmente">
      <table className="apoio-orders-table">
        <caption className="apoio-visually-hidden">Ordens de serviço filtradas no modo tabela</caption>
        <thead>
          <tr>
            <th scope="col">Frota</th>
            <th scope="col">OS</th>
            <th scope="col">Equipamento</th>
            <th scope="col">Grupo Apoio / local / prestador</th>
            <th scope="col">Situação operacional</th>
            <th scope="col">Entrada / previsão</th>
            <th scope="col">Narrativa</th>
            <th scope="col">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={8} className="apoio-table-empty">Nenhuma ordem nesta seleção.</td>
            </tr>
          )}
          {rows.map((row, index) => {
            const closure = getMaintenanceOrderClosure(row);
            const status = apoioOrderStatusLabel(row);
            const raw = rawStatus(row);
            const closed = closure.status === 'encerrado';
            const late = !closed && apoioForecastOverdue(row);
            const rowDetailId = detailId(row.chave, index);
            const toggleId = `${rowDetailId}-toggle`;
            const isExpanded = expanded === row.chave;
            const local = oficinaLabel(row.origem);
            const groupId = groupIdForFleet(row.frota);
            const note = closureNote(row, closure);
            const narrative = row.narrativa || 'Sem narrativa informada';

            return (
              <Fragment key={`${row.chave}-${index}`}>
                <tr className={`apoio-table-row${index % 2 === 1 ? ' is-odd' : ''}${closed ? ' apoio-table-row-closed' : ''}${late ? ' apoio-table-row-forecast-late' : ''}${isExpanded ? ' is-expanded' : ''}`}>
                  <th scope="row" className="apoio-table-fleet-cell">
                    <strong>{fleetLabel(row)}</strong>
                    {closed && <span className="apoio-table-closed-mark"><CheckCircle2 size={13} aria-hidden="true" />Encerrada</span>}
                  </th>
                  <td className="apoio-table-os-cell">{row.os || 'Não informada'}</td>
                  <td className="apoio-table-equipment-cell">
                    <div className="apoio-table-equipment-wrap">
                      <EquipmentThumbnail equipment={row} size="table" />
                      <div>
                        <strong className="apoio-table-equipment">{row.equipamento || row.modelo || 'Equipamento não informado'}</strong>
                        {row.modelo && row.modelo !== row.equipamento && <span className="apoio-table-secondary">Modelo: {row.modelo}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="apoio-table-group-cell">
                    <strong className="apoio-table-group">{row.apoio || 'Não cadastrado'}</strong>
                    {onAssign && groups.length > 0 && row.frota !== 'SEM-FROTA' && (
                      <label className="apoio-table-assignment">
                        <span className="apoio-visually-hidden">Grupo Apoio da frota {fleetLabel(row)}</span>
                        <select value={groupId} disabled={busy} onChange={event => onAssign(row, event.target.value)}>
                          <option value="" disabled>Não cadastrado</option>
                          {groups.map(group => <option key={group.id} value={group.id}>{group.nome}</option>)}
                        </select>
                      </label>
                    )}
                    <span className="apoio-table-secondary"><MapPin size={13} aria-hidden="true" />{local}</span>
                    <span className="apoio-table-secondary">{local === 'Oficina Externa' ? `Prestador: ${row.prestador || 'não informado'}` : localDetail(row)}</span>
                  </td>
                  <td>
                    <span className={`apoio-table-status apoio-table-status-${statusClass(closure.status)}`}>{status}</span>
                    {!closed && closure.status === 'ausente' && <span className="apoio-table-secondary">Sem confirmação</span>}
                    {closed && <span className="apoio-table-secondary">Não é atraso</span>}
                  </td>
                  <td className="apoio-table-date-cell">
                    <span><strong>Entrada</strong>{formatDate(row.entrada)}</span>
                    <span><strong>Previsão</strong>{formatDate(row.previsao)}{late && <em className="apoio-table-late">Atrasada</em>}</span>
                    {late && <span className="apoio-table-forecast-badge"><AlertTriangle size={12} aria-hidden="true" />Previsão vencida</span>}
                  </td>
                  <td className="apoio-table-narrative-cell">
                    <p className="apoio-table-narrative-summary">{narrative}</p>
                    <span className="apoio-table-secondary">Texto completo nos detalhes</span>
                  </td>
                  <td className="apoio-table-actions-cell">
                    <button
                      id={toggleId}
                      type="button"
                      className="apoio-table-details-button"
                      aria-expanded={isExpanded}
                      aria-controls={rowDetailId}
                      onClick={() => onToggle(row.chave)}
                    >
                      {isExpanded ? 'Ocultar' : 'Detalhes'}<ChevronDown size={16} aria-hidden="true" className={isExpanded ? 'rotate-180' : ''} />
                    </button>
                  </td>
                </tr>
                <tr className="apoio-table-detail-row">
                  <td colSpan={8}>
                    <div id={rowDetailId} className="apoio-table-detail" role="region" aria-labelledby={toggleId} hidden={!isExpanded}>
                      <div className="apoio-table-detail-heading">
                        <div><strong>Detalhes da OS {row.os || 'não informada'}</strong><span>Frota {fleetLabel(row)}</span></div>
                        <span className={`apoio-table-status apoio-table-status-${statusClass(closure.status)}`}>{status}</span>
                      </div>
                      {note && <p className={`apoio-table-closure-note${closed ? ' is-closed' : ''}`}>{note}</p>}
                      <dl className="apoio-table-detail-grid">
                        <div><dt>Situação operacional</dt><dd>{status}</dd></div>
                        <div><dt>Status bruto na fonte</dt><dd>{raw}</dd></div>
                        <div><dt>Origem do encerramento</dt><dd>{closureOriginLabel(closure.origin)}</dd></div>
                        <div><dt>Detecção de encerramento</dt><dd>{formatDate(closure.detectedAt)}</dd></div>
                        <div><dt>Origem / local</dt><dd>{local}</dd></div>
                        <div><dt>Prestador</dt><dd>{row.prestador || 'Não informado'}</dd></div>
                        <div><dt>Setor</dt><dd>{row.setor || 'Não informado'}</dd></div>
                        <div><dt>Ponto de manutenção</dt><dd>{row.ponto || 'Não informado'}</dd></div>
                        <div><dt>Grupo na fonte</dt><dd>{row.grupo_fonte || 'Não informado'}</dd></div>
                        <div><dt>Primeira observação</dt><dd>{formatDate(row.primeira_vista)}</dd></div>
                        <div><dt>Última observação</dt><dd>{formatDate(row.ultima_vista)}</dd></div>
                        <div><dt>Entrada</dt><dd>{formatDate(row.entrada)}</dd></div>
                        <div><dt>Previsão</dt><dd>{formatDate(row.previsao)}{late ? ' · atrasada' : ''}{late && <span className="apoio-table-forecast-badge"><AlertTriangle size={12} aria-hidden="true" />Previsão vencida</span>}</dd></div>
                      </dl>
                      <div className="apoio-table-full-narrative">
                        <strong>Narrativa completa</strong>
                        <p>{narrative}</p>
                      </div>
                      <p className="apoio-table-detail-disclaimer">Os dados refletem a fonte disponível. Detecção de encerramento não é data de execução, e a execução humana não é inferida.</p>
                      <a className="apoio-table-backlink" href={`#${toggleId}`} onClick={event => { event.preventDefault(); onToggle(row.chave); }}><ExternalLink size={14} aria-hidden="true" />Voltar ao resumo da linha</a>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
