import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface ApoioMultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  label: string;
  options: ApoioMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  description?: string;
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function ApoioMultiSelect({ label, options, value, onChange, description }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popoverId = `apoio-multi-${label.toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/gi, '-')}`;
  const selected = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter(option => selected.has(option.value));
  const shown = options.filter(option => fold(`${option.label} ${option.value}`).includes(fold(query.trim())));
  const selectedVisible = shown.filter(option => selected.has(option.value));
  const caption = value.length === 0 ? 'Todos' : value.length === 1 ? selectedOptions[0]?.label || '1 selecionado' : `${value.length} selecionados`;

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const toggle = (option: ApoioMultiSelectOption) => {
    onChange(selected.has(option.value) ? value.filter(item => item !== option.value) : [...value, option.value]);
  };
  const selectVisible = () => onChange([...new Set([...value, ...shown.map(option => option.value)])]);
  const clear = () => onChange([]);

  return (
    <div className="apoio-multi-select" ref={root}>
      <div className="apoio-multi-select-label-row">
        <span className="apoio-multi-select-label">{label}</span>
        {description && <span className="apoio-multi-select-description">{description}</span>}
      </div>
      <button
        ref={trigger}
        type="button"
        className="apoio-multi-select-trigger"
        aria-label={`Filtrar ${label}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen(current => !current)}
      >
        <span className="apoio-multi-select-caption" title={selectedOptions.map(option => option.label).join(', ')}>{caption}</span>
        <span className="apoio-multi-select-count">{value.length ? value.length : 'Todos'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {selectedOptions.length > 0 && (
        <div className="apoio-multi-select-chips" aria-label={`Seleções de ${label}`}>
          {selectedOptions.map(option => (
            <span className="apoio-multi-select-chip" key={option.value}>
              <span>{option.label}</span>
              {option.count !== undefined && <small>{option.count}</small>}
              <button type="button" aria-label={`Remover ${option.label} de ${label}`} onClick={() => toggle(option)}><X size={12} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      {open && (
        <div id={popoverId} className="apoio-multi-select-popover" role="dialog" aria-label={`Opções de ${label}`}>
          <div className="apoio-multi-select-search">
            <Search size={15} aria-hidden="true" />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar opções…" aria-label={`Pesquisar opções de ${label}`} />
            <button type="button" aria-label={`Fechar filtro ${label}`} onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={15} aria-hidden="true" /></button>
          </div>
          <div className="apoio-multi-select-actions">
            <button type="button" onClick={selectVisible} disabled={!shown.length}><Check size={14} aria-hidden="true" />Selecionar visíveis<span>{shown.length}</span></button>
            <button type="button" onClick={clear} disabled={!value.length}>Limpar seleção</button>
          </div>
          <div className="apoio-multi-select-visible-summary" aria-live="polite">
            {selectedVisible.length} de {shown.length} visíveis selecionadas · {options.length} opções
          </div>
          <div className="apoio-multi-select-options">
            {shown.map(option => (
              <label className={`apoio-multi-select-option${selected.has(option.value) ? ' is-selected' : ''}`} key={option.value || '__empty__'}>
                <input type="checkbox" checked={selected.has(option.value)} onChange={() => toggle(option)} />
                <span>{option.label}</span>
                {option.count !== undefined && <small>{option.count.toLocaleString('pt-BR')}</small>}
              </label>
            ))}
            {!shown.length && <p className="apoio-multi-select-empty">Nenhuma opção encontrada.</p>}
          </div>
          <p className="apoio-multi-select-footer"><Check size={13} aria-hidden="true" />Sem seleção considera todas as opções.</p>
        </div>
      )}
    </div>
  );
}
