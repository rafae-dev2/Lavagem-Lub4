import { useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronUp, Clock, Edit2, FileText, Loader2, Play, RotateCcw, Trash2, Truck } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { Programacao, StatusType } from '../types';
import StatusBadge from './StatusBadge';
import EquipmentThumbnail from './EquipmentThumbnail';
import { cleanScheduleObservation, effectiveScheduleCompletionDate } from '../lib/schedulePresentation';

interface Props {
  schedules: Programacao[];
  sortField: keyof Programacao;
  sortDir: 'asc' | 'desc';
  onSort: (field: keyof Programacao) => void;
  onEdit: (schedule: Programacao) => void;
  onDelete: (id: string) => void;
  onQuick: (schedule: Programacao, status: StatusType) => void;
  onPostpone: (schedule: Programacao) => void;
  onOpenFrota: (frota: string) => void;
  quickUpdating: string | null;
  deleting: string | null;
  compactCards?: boolean;
}

function dateLabel(value: string): string {
  if (!value) return '—';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'dd/MM/yyyy') : 'Data inválida';
}

const columns: { label: string; field: keyof Programacao }[] = [
  { label: 'Equipamento / OS', field: 'frota' },
  { label: 'Serviço / local', field: 'tipoPreventiva' },
  { label: 'Programação', field: 'dataProgramada' },
  { label: 'Situação', field: 'situacao' },
  { label: 'Data realizada', field: 'dataRealizada' },
  { label: 'Observações', field: 'observacao' },
];

export default function LubricationScheduleTable(props: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (props.compactCards) {
    return (
      <div className="lub-schedule-cards" role="list" aria-label="Cartões de programações de lubrificação">
        {!props.schedules.length && <div className="lub-empty" role="listitem"><FileText size={30} /><strong>Nenhuma programação nesta seleção</strong><p>Ajuste os filtros ou mostre as encerradas para consultar mais registros.</p></div>}
        {props.schedules.map(schedule => {
          const pcm = schedule.origemRegistro === 'PCM';
          const closed = schedule.situacao === 'ENCERRADO';
          const observation = cleanScheduleObservation(schedule);
          const completion = effectiveScheduleCompletionDate(schedule);
          const isUpdating = props.quickUpdating === schedule.id;
          const expanded = expandedId === schedule.id;
          return (
            <article
              key={schedule.id}
              className={`lub-schedule-card glass-card${expanded ? ' is-expanded is-active' : ''}`}
              data-status={schedule.situacao}
              role="listitem"
            >
              <div className="lub-schedule-card-head">
                <div className="lub-schedule-card-identity">
                  <div className="lub-equipment-identity">
                    <EquipmentThumbnail equipment={schedule} size="table" />
                    <div>
                      <button type="button" className="lub-fleet" onClick={() => props.onOpenFrota(schedule.frota)} title={`Consultar histórico da frota ${schedule.frota}`}><Truck size={14} />{schedule.frota}</button>
                      <div className="lub-origin-line"><span className={`lub-origin ${pcm ? 'is-pcm' : ''}`}>{pcm ? 'PCM' : 'Manual'}</span>{schedule.numeroOS && <span className="lub-os">OS {schedule.numeroOS}</span>}</div>
                      {schedule.apoioNome && <p className="lub-group">{schedule.apoioNome}</p>}
                    </div>
                  </div>
                  <strong className="lub-service">{schedule.tipoPreventiva}</strong>
                  <span className="lub-secondary">{schedule.descricaoPonto || 'Local não informado'}</span>
                </div>
                <StatusBadge status={schedule.situacao} size="sm" />
              </div>
              <div className="lub-schedule-card-fields">
                <div className="lub-schedule-card-field"><span>Programação</span><strong className="lub-date">{dateLabel(schedule.dataProgramada)}</strong><small className="lub-secondary lub-time"><Clock size={12} />{schedule.horarioAgendado || 'Sem horário'}</small></div>
                <div className="lub-schedule-card-field"><span>Data realizada</span><strong className={`lub-date${closed && completion ? ' is-complete' : ''}`}>{dateLabel(completion)}</strong>{pcm && closed && completion && <small className="lub-secondary">{schedule.execucaoConfirmadaEm ? 'Confirmada' : 'Registrada no controle'}</small>}</div>
              </div>
              <div className="lub-schedule-card-observation">
                <span className="lub-secondary">Observações</span>
                {observation ? <p className={`lub-observation${expanded ? '' : ' line-clamp-2'}`}>{observation}</p> : <span className="lub-secondary">Sem observações</span>}
                {(observation.length > 90 || schedule.narrativaPCM) && <button type="button" className="lub-detail" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : schedule.id)}>{expanded ? 'Recolher' : 'Ver detalhes'}<ChevronDown size={12} className={expanded ? 'rotate-180' : ''} /></button>}
                {expanded && schedule.narrativaPCM && <div className="lub-narrative"><strong>Narrativa da OS</strong><p>{schedule.narrativaPCM}</p></div>}
              </div>
              <div className="lub-schedule-card-actions">
                <button type="button" className="lub-edit" onClick={() => props.onEdit(schedule)} aria-label={`Editar programação da frota ${schedule.frota}${schedule.numeroOS ? ` OS ${schedule.numeroOS}` : ''}`}><Edit2 size={14} /><span>Editar</span></button>
                {!pcm && <div className="lub-quick-actions">
                  {!closed && schedule.situacao !== 'ANDAMENTO' && <button type="button" aria-label={`Iniciar frota ${schedule.frota}`} title="Iniciar" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'ANDAMENTO')}>{isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}</button>}
                  {!closed && <button type="button" aria-label={`Concluir frota ${schedule.frota}`} title="Concluir" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'ENCERRADO')}>{isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>}
                  {!closed && <button type="button" aria-label={`Adiar frota ${schedule.frota}`} title="Adiar um dia" disabled={!!props.quickUpdating} onClick={() => props.onPostpone(schedule)}><CalendarClock size={14} /></button>}
                  {closed && <button type="button" aria-label={`Reabrir frota ${schedule.frota}`} title="Reabrir" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'PROGRAMADO')}><RotateCcw size={14} /></button>}
                  <button type="button" className="lub-delete" aria-label={`Excluir programação da frota ${schedule.frota}`} title="Excluir programação manual" disabled={props.deleting === schedule.id} onClick={() => props.onDelete(schedule.id)}>{props.deleting === schedule.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                </div>}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="lub-table-scroll" role="region" aria-label="Tabela de programações de lubrificação" tabIndex={0}>
      <table className="lub-table">
        <caption className="sr-only">Programações de lavagem e lubrificação: equipamentos, serviços, datas, situação, observações e ações.</caption>
        <thead><tr>{columns.map(column => <th key={column.field} scope="col" aria-sort={props.sortField === column.field ? (props.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
          <button type="button" onClick={() => props.onSort(column.field)}>{column.label}{props.sortField === column.field && (props.sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</button>
        </th>)}<th scope="col" className="lub-actions-cell">Ações</th></tr></thead>
        <tbody>
          {!props.schedules.length && <tr><td colSpan={7}><div className="lub-empty"><FileText size={30} /><strong>Nenhuma programação nesta seleção</strong><p>Ajuste os filtros ou mostre as encerradas para consultar mais registros.</p></div></td></tr>}
          {props.schedules.map(schedule => {
            const pcm = schedule.origemRegistro === 'PCM';
            const closed = schedule.situacao === 'ENCERRADO';
            const observation = cleanScheduleObservation(schedule);
            const completion = effectiveScheduleCompletionDate(schedule);
            const isUpdating = props.quickUpdating === schedule.id;
            const expanded = expandedId === schedule.id;
            return (
              <tr key={schedule.id} className={`lub-row lub-row-${schedule.situacao.toLowerCase()}`} data-status={schedule.situacao}>
                <td data-label="Equipamento / OS"><div className="lub-equipment-identity"><EquipmentThumbnail equipment={schedule} size="table" /><div><button type="button" className="lub-fleet" onClick={() => props.onOpenFrota(schedule.frota)} title={`Consultar histórico da frota ${schedule.frota}`}><Truck size={14} />{schedule.frota}</button><div className="lub-origin-line"><span className={`lub-origin ${pcm ? 'is-pcm' : ''}`}>{pcm ? 'PCM' : 'Manual'}</span>{schedule.numeroOS && <span className="lub-os">OS {schedule.numeroOS}</span>}</div>{schedule.apoioNome && <p className="lub-group">{schedule.apoioNome}</p>}</div></div></td>
                <td data-label="Serviço / local"><strong className="lub-service">{schedule.tipoPreventiva}</strong><span className="lub-secondary">{schedule.descricaoPonto || 'Local não informado'}</span></td>
                <td data-label="Programação"><span className="lub-date">{dateLabel(schedule.dataProgramada)}</span><span className="lub-secondary lub-time"><Clock size={12} />{schedule.horarioAgendado || 'Sem horário'}</span></td>
                <td data-label="Situação"><StatusBadge status={schedule.situacao} size="sm" />{pcm && !closed && schedule.statusPCM && <span className="lub-secondary">PCM · {schedule.statusPCM}</span>}</td>
                <td data-label="Data realizada"><span className={`lub-date${closed && completion ? ' is-complete' : ''}`}>{dateLabel(completion)}</span>{pcm && closed && completion && <span className="lub-secondary">{schedule.execucaoConfirmadaEm ? 'Confirmada' : 'Registrada no controle'}</span>}</td>
                <td data-label="Observações" className="lub-observation-cell">{observation ? <p className={`lub-observation${expanded ? '' : ' line-clamp-2'}`}>{observation}</p> : <span className="lub-secondary">Sem observações</span>}{(observation.length > 90 || schedule.narrativaPCM) && <button type="button" className="lub-detail" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : schedule.id)}>{expanded ? 'Recolher' : 'Ver detalhes'}<ChevronDown size={12} className={expanded ? 'rotate-180' : ''} /></button>}{expanded && schedule.narrativaPCM && <div className="lub-narrative"><strong>Narrativa da OS</strong><p>{schedule.narrativaPCM}</p></div>}</td>
                <td data-label="Ações" className="lub-actions-cell"><div className="lub-row-actions"><button type="button" className="lub-edit" onClick={() => props.onEdit(schedule)} aria-label={`Editar programação da frota ${schedule.frota}${schedule.numeroOS ? ` OS ${schedule.numeroOS}` : ''}`}><Edit2 size={14} /><span>Editar</span></button>{!pcm && <div className="lub-quick-actions">{!closed && schedule.situacao !== 'ANDAMENTO' && <button type="button" aria-label={`Iniciar frota ${schedule.frota}`} title="Iniciar" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'ANDAMENTO')}>{isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}</button>}{!closed && <button type="button" aria-label={`Concluir frota ${schedule.frota}`} title="Concluir" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'ENCERRADO')}>{isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}</button>}{!closed && <button type="button" aria-label={`Adiar frota ${schedule.frota}`} title="Adiar um dia" disabled={!!props.quickUpdating} onClick={() => props.onPostpone(schedule)}><CalendarClock size={14} /></button>}{closed && <button type="button" aria-label={`Reabrir frota ${schedule.frota}`} title="Reabrir" disabled={!!props.quickUpdating} onClick={() => props.onQuick(schedule, 'PROGRAMADO')}><RotateCcw size={14} /></button>}<button type="button" className="lub-delete" aria-label={`Excluir programação da frota ${schedule.frota}`} title="Excluir programação manual" disabled={props.deleting === schedule.id} onClick={() => props.onDelete(schedule.id)}>{props.deleting === schedule.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button></div>}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
