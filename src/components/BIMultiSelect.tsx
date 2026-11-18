import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface BISelectOption { value: string; label: string; count?: number; }
interface Props { label: string; options: BISelectOption[]; value: string[]; onChange: (value: string[]) => void; }
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function BIMultiSelect({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const selectedLabels = options.filter(option => value.includes(option.value)).map(option => option.label);
  const caption = !value.length ? 'Todos' : value.length === 1 ? selectedLabels[0] || '1 selecionado' : `${value.length} selecionados`;
  const shown = options.filter(option => fold(option.label).includes(fold(query.trim())));
  return <div className="bi-multi" ref={root}>
    <span className="bi-field-label">{label}</span>
    <button ref={trigger} className="bi-select-trigger" type="button" aria-label={`Filtrar ${label}`} aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span title={selectedLabels.join(', ')}>{caption}</span><ChevronDown size={14} />
    </button>
    {open && <div className="bi-select-popover" role="group" aria-label={`Opções de ${label}`}>
      <div className="bi-select-search"><Search size={14} /><input autoFocus aria-label={`Pesquisar ${label}`} placeholder="Localizar opção…" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" aria-label={`Fechar ${label}`} onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={14} /></button></div>
      <button className="bi-select-clear" type="button" onClick={() => onChange([])}>Todos · limpar seleção</button>
      <div className="bi-select-options">{shown.map(option => <label key={option.value || '__empty__'} title={option.label}>
        <input type="checkbox" checked={value.includes(option.value)} onChange={() => onChange(value.includes(option.value) ? value.filter(item => item !== option.value) : [...value, option.value])} />
        <span>{option.label}</span>{option.count !== undefined && <small>{option.count.toLocaleString('pt-BR')}</small>}
      </label>)}{!shown.length && <p>Nenhuma opção encontrada.</p>}</div>
      <div className="bi-select-footer"><Check size={12} />Sem seleção, considera todas as opções da base.</div>
    </div>}
  </div>;
}
