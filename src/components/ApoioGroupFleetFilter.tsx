import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { ApoioFleet, ApoioGroup, ApoioReportRow } from '../types/apoio';
import type { ApoioFleetsByGroup } from '../lib/apoioFilters';
import '../styles/apoio-fleet-filter.css';
import { getCardTiltProps } from '../hooks/useCardTilt';

export interface ApoioGroupFleetFilterProps {
  groups: ApoioGroup[];
  fleets: ApoioFleet[];
  baseRows: ApoioReportRow[];
  selectedGroups: string[];
  fleetsByGroup: ApoioFleetsByGroup;
  onGroupsChange: (groups: string[]) => void;
  onFleetsByGroupChange: (fleetsByGroup: ApoioFleetsByGroup) => void;
  onClear: () => void;
}

export interface ApoioGroupFleetOption {
  frota: string;
  nome: string;
  count: number;
}

function groupOptions(groups: ApoioGroup[], fleets: ApoioFleet[], baseRows: ApoioReportRow[]): Map<string, ApoioGroupFleetOption[]> {
  const countsByFleet = new Map<string, number>();
  const firstRowByFleet = new Map<string, ApoioReportRow>();
  baseRows.forEach(row => {
    countsByFleet.set(row.frota, (countsByFleet.get(row.frota) || 0) + 1);
    if (!firstRowByFleet.has(row.frota)) firstRowByFleet.set(row.frota, row);
  });

  return new Map(groups.map(group => {
    const options = fleets
      .filter(fleet => fleet.grupo_id === group.id)
      .map(fleet => {
        const row = firstRowByFleet.get(fleet.frota);
        return {
          frota: fleet.frota,
          nome: fleet.nome || row?.equipamento || row?.modelo || 'Equipamento sem nome',
          count: countsByFleet.get(fleet.frota) || 0,
        };
      })
      .sort((a, b) => a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true }));
    return [group.id, options];
  }));
}

function hasRestriction(fleetsByGroup: ApoioFleetsByGroup, groupId: string): boolean {
  return Object.prototype.hasOwnProperty.call(fleetsByGroup, groupId);
}

function countGridTracks(template: string): number {
  if (!template || template === 'none') return 1;
  let depth = 0;
  let hasToken = false;
  let count = 0;
  for (const character of template) {
    if (character === '(') {
      depth += 1;
      hasToken = true;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
    } else if (/\s/.test(character) && depth === 0) {
      if (hasToken) {
        count += 1;
        hasToken = false;
      }
    } else if (depth === 0 || !/\s/.test(character)) {
      hasToken = true;
    }
  }
  if (hasToken) count += 1;
  return Math.max(1, count);
}

export default function ApoioGroupFleetFilter({
  groups,
  fleets,
  baseRows,
  selectedGroups,
  fleetsByGroup,
  onGroupsChange,
  onFleetsByGroupChange,
  onClear,
}: ApoioGroupFleetFilterProps) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [gridColumns, setGridColumns] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);
  const originButtonRef = useRef<HTMLButtonElement | null>(null);
  const openingGroupRef = useRef<string | null>(null);
  const fleetOptionTiltProps = getCardTiltProps<HTMLLabelElement>({ maxTiltDeg: 4.5, scale: 1.012 });
  const fleetTileTiltProps = getCardTiltProps<HTMLDivElement>({ maxTiltDeg: 4.5, scale: 1.012 });
  const optionsByGroup = useMemo(() => groupOptions(groups, fleets, baseRows), [baseRows, fleets, groups]);
  const openGroup = groups.find(group => group.id === openGroupId) || null;
  const openOptions = openGroup ? optionsByGroup.get(openGroup.id) || [] : [];
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const visibleOptions = openOptions.filter(option => option.frota.toLocaleLowerCase('pt-BR').includes(normalizedSearch));
  const openSelection = openGroup ? fleetsByGroup[openGroup.id] : undefined;
  const openSelected = openGroup && hasRestriction(fleetsByGroup, openGroup.id)
    ? new Set(openSelection || [])
    : new Set(openOptions.map(option => option.frota));

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const measureColumns = () => {
      const columns = countGridTracks(getComputedStyle(grid).gridTemplateColumns);
      setGridColumns(previous => previous === columns ? previous : columns);
    };

    measureColumns();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measureColumns);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!openGroupId) return;
    if (!openGroup) {
      setOpenGroupId(null);
      setSearch('');
      openingGroupRef.current = null;
      return;
    }
    if (selectedGroups.includes(openGroupId)) {
      openingGroupRef.current = null;
      return;
    }
    // Keep the panel mounted for the same event that adds a previously
    // unselected group; close it when the parent removes the group later.
    if (openingGroupRef.current !== openGroupId) {
      setOpenGroupId(null);
      setSearch('');
    }
  }, [openGroup, openGroupId, selectedGroups]);

  useEffect(() => {
    if (!openGroupId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePicker(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openGroupId]);

  const closePicker = (restoreFocus = false) => {
    const origin = originButtonRef.current;
    setOpenGroupId(null);
    setSearch('');
    openingGroupRef.current = null;
    if (restoreFocus) origin?.focus();
  };

  const openPicker = (groupId: string, button: HTMLButtonElement) => {
    if (openGroupId === groupId) {
      closePicker(true);
      return;
    }
    originButtonRef.current = button;
    openingGroupRef.current = selectedGroups.includes(groupId) ? null : groupId;
    if (!selectedGroups.includes(groupId)) onGroupsChange([...selectedGroups, groupId]);
    setOpenGroupId(groupId);
    setSearch('');
  };

  const toggleGroup = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onGroupsChange(selectedGroups.filter(id => id !== groupId));
      const next = { ...fleetsByGroup };
      delete next[groupId];
      onFleetsByGroupChange(next);
      if (openGroupId === groupId) closePicker(false);
      return;
    }
    onGroupsChange([...selectedGroups, groupId]);
  };

  const clearSelection = () => {
    closePicker(false);
    onClear();
  };

  const updateSelection = (frota: string, checked: boolean) => {
    if (!openGroup) return;
    const nextSelected = new Set(openSelected);
    if (checked) nextSelected.add(frota);
    else nextSelected.delete(frota);
    const values = [...nextSelected];
    const next = { ...fleetsByGroup };
    // Missing key is intentionally the durable representation for “all”, so
    // a future sync can add a new registered fleet without pruning selection.
    if (values.length === openOptions.length && openOptions.every(option => nextSelected.has(option.frota))) delete next[openGroup.id];
    else next[openGroup.id] = values;
    onFleetsByGroupChange(next);
  };

  const selectAll = () => {
    if (!openGroup) return;
    const next = { ...fleetsByGroup };
    delete next[openGroup.id];
    onFleetsByGroupChange(next);
  };

  const selectNone = () => {
    if (!openGroup) return;
    onFleetsByGroupChange({ ...fleetsByGroup, [openGroup.id]: [] });
  };

  const removeGroup = () => {
    if (!openGroup) return;
    onGroupsChange(selectedGroups.filter(id => id !== openGroup.id));
    const next = { ...fleetsByGroup };
    delete next[openGroup.id];
    onFleetsByGroupChange(next);
    closePicker(true);
  };

  const selectionLabel = (groupId: string, count: number) => {
    if (!hasRestriction(fleetsByGroup, groupId)) return `${count} frotas · todas`;
    const selected = fleetsByGroup[groupId]?.length || 0;
    return `${selected} de ${count} frotas`;
  };

  const openGroupIndex = openGroupId ? groups.findIndex(group => group.id === openGroupId) : -1;
  const rowEndIndex = openGroupIndex >= 0
    ? Math.min(groups.length - 1, (Math.floor(openGroupIndex / Math.max(1, gridColumns)) + 1) * Math.max(1, gridColumns) - 1)
    : -1;
  const pickerId = openGroup ? `apoio-group-fleet-picker-${openGroup.id}` : undefined;

  const renderPicker = () => {
    if (!openGroup) return null;
    return (
      <section id={pickerId} className="apoio-group-fleet-picker" aria-label={`Frotas do grupo ${openGroup.nome}`}>
        <div className="apoio-group-fleet-picker-heading">
          <div>
            <strong><span className="apoio-group-fleet-dot" style={{ background: openGroup.cor }} />{openGroup.nome}</strong>
            <span>{openOptions.length} frotas cadastradas · {openSelected.size} selecionadas</span>
          </div>
          <button type="button" className="apoio-group-fleet-close" onClick={() => closePicker(true)} aria-label="Fechar seletor de frotas"><X size={17} /></button>
        </div>
        <p className="apoio-group-fleet-live-note">Seleção aplicada automaticamente aos relatórios.</p>
        <div className="apoio-group-fleet-actions">
          <label className="apoio-group-fleet-search"><Search size={15} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} inputMode="numeric" placeholder="Buscar número da frota" aria-label="Buscar número da frota" /></label>
          <button type="button" onClick={selectAll}>Todas</button>
          <button type="button" onClick={selectNone}>Nenhuma</button>
          <button type="button" className="apoio-group-fleet-remove" onClick={removeGroup}>Remover grupo</button>
          <button type="button" className="apoio-group-fleet-done" onClick={() => closePicker(true)}>Concluir</button>
        </div>
        <div className="apoio-group-fleet-options">
          {visibleOptions.map(option => {
            const checked = openSelected.has(option.frota);
            return <label {...fleetOptionTiltProps} className={`glass-card apoio-group-fleet-option tilt-card${checked ? ' is-selected' : ''}`} key={option.frota}>
              <input type="checkbox" checked={checked} onChange={event => updateSelection(option.frota, event.target.checked)} aria-label={`Selecionar frota ${option.frota}`} />
              <span className="apoio-group-fleet-option-text"><strong>Frota {option.frota}</strong><small>{option.nome}</small></span>
              <span className="apoio-group-fleet-option-count">{option.count ? `${option.count} ${option.count === 1 ? 'ordem' : 'ordens'}` : 'sem ordens'}</span>
            </label>;
          })}
          {!visibleOptions.length && <span className="apoio-group-fleet-empty">Nenhuma frota encontrada.</span>}
        </div>
      </section>
    );
  };

  return (
    <div className="apoio-group-fleet-filter" aria-label="Filtro de grupos Apoio e frotas">
      <div className="apoio-group-fleet-heading">
        <div>
          <span className="apoio-group-fleet-title">Filtrar grupos Apoio</span>
          <span className="apoio-group-fleet-subtitle">Selecione um grupo e escolha as frotas dos relatórios</span>
        </div>
        {(selectedGroups.length > 0 || Object.keys(fleetsByGroup).length > 0) && (
          <button type="button" className="apoio-group-fleet-clear" onClick={clearSelection}>Limpar seleção</button>
        )}
      </div>

      <div className="apoio-group-fleet-toolbar">
        <button type="button" className={`apoio-group-fleet-all${!selectedGroups.length ? ' is-active' : ''}`} onClick={clearSelection} aria-pressed={!selectedGroups.length}>
          <span className="apoio-group-fleet-checkbox" aria-hidden="true">{!selectedGroups.length && <Check size={13} />}</span>
          Todos
        </button>
        <span className="apoio-group-fleet-summary" aria-live="polite">
          {selectedGroups.length ? `${selectedGroups.length} ${selectedGroups.length === 1 ? 'grupo selecionado' : 'grupos selecionados'}` : 'Todos os grupos'}
        </span>
      </div>

      <div className="apoio-group-fleet-grid" ref={gridRef}>
        {groups.map((group, index) => {
          const options = optionsByGroup.get(group.id) || [];
          const selected = selectedGroups.includes(group.id);
          const isOpen = openGroupId === group.id;
          return <React.Fragment key={group.id}>
            <div {...fleetTileTiltProps} className={`glass-card apoio-group-fleet-tile tilt-card${selected ? ' is-selected' : ''}${isOpen ? ' is-open is-active' : ''}`}>
              <button
                type="button"
                className="apoio-group-fleet-tile-main"
                onClick={event => openPicker(group.id, event.currentTarget)}
                aria-expanded={isOpen}
                aria-controls={isOpen ? pickerId : undefined}
              >
                <span className="apoio-group-fleet-dot" style={{ background: group.cor }} />
                <span className="apoio-group-fleet-tile-copy"><strong>{group.nome}</strong><small>{selectionLabel(group.id, options.length)}</small></span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="apoio-group-fleet-tile-check"
                role="checkbox"
                aria-checked={selected}
                aria-label={`${selected ? 'Remover' : 'Selecionar'} grupo ${group.nome}`}
                title={selected ? 'Remover grupo' : 'Selecionar grupo'}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="apoio-group-fleet-checkbox" aria-hidden="true">{selected && <Check size={13} />}</span>
              </button>
            </div>
            {index === rowEndIndex && renderPicker()}
          </React.Fragment>;
        })}
        {!groups.length && <span className="apoio-group-fleet-empty">Nenhum grupo Apoio cadastrado.</span>}
      </div>
    </div>
  );
}
