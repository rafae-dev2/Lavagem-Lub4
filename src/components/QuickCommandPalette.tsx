import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  CornerDownLeft,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { PageType } from "../types";
import {
  type CommandPaletteModuleItem,
  type CommandPaletteQuickAction,
  filterCommandActions,
  filterCommandModules,
} from "../lib/quickCommandPalette";

export interface PaletteModuleEntry extends CommandPaletteModuleItem {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

export interface PaletteActionEntry extends CommandPaletteQuickAction {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  onSelect: () => void;
}

interface QuickCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  currentPage: PageType;
  modules: readonly PaletteModuleEntry[];
  actions: readonly PaletteActionEntry[];
  favorites: readonly PageType[];
  recents: readonly PageType[];
  onNavigate: (page: PageType) => void;
  onToggleFavorite: (page: PageType) => void;
}

type FlatRow =
  | { kind: "module"; key: string; entry: PaletteModuleEntry }
  | { kind: "action"; key: string; entry: PaletteActionEntry };

export default function QuickCommandPalette({
  open,
  onClose,
  currentPage,
  modules,
  actions,
  favorites,
  recents,
  onNavigate,
  onToggleFavorite,
}: QuickCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const moduleMap = useMemo(
    () => new Map(modules.map((mod) => [mod.id, mod])),
    [modules],
  );

  const hasQuery = query.trim().length > 0;

  const filteredModules = useMemo(() => {
    const matched = filterCommandModules(modules, query, favorites, recents);
    return matched
      .map((item) => moduleMap.get(item.id))
      .filter((entry): entry is PaletteModuleEntry => Boolean(entry));
  }, [modules, query, favorites, recents, moduleMap]);

  const filteredActions = useMemo(() => {
    const matched = filterCommandActions(actions, query);
    const ids = new Set(matched.map((item) => item.id));
    return actions.filter((action) => ids.has(action.id));
  }, [actions, query]);

  const favoriteModules = useMemo(
    () =>
      favorites
        .map((id) => moduleMap.get(id))
        .filter((entry): entry is PaletteModuleEntry => Boolean(entry)),
    [favorites, moduleMap],
  );

  const recentModules = useMemo(() => {
    const favSet = new Set(favorites);
    return recents
      .filter((id) => !favSet.has(id))
      .map((id) => moduleMap.get(id))
      .filter((entry): entry is PaletteModuleEntry => Boolean(entry));
  }, [recents, favorites, moduleMap]);

  const sections = useMemo(() => {
    const list: { title: string; rows: FlatRow[] }[] = [];

    if (!hasQuery) {
      if (favoriteModules.length > 0) {
        list.push({
          title: "Favoritos",
          rows: favoriteModules.map((entry) => ({
            kind: "module",
            key: `fav:${entry.id}`,
            entry,
          })),
        });
      }
      if (recentModules.length > 0) {
        list.push({
          title: "Recentes",
          rows: recentModules.map((entry) => ({
            kind: "module",
            key: `rec:${entry.id}`,
            entry,
          })),
        });
      }
      if (filteredActions.length > 0) {
        list.push({
          title: "Ações rápidas",
          rows: filteredActions.map((entry) => ({
            kind: "action",
            key: `act:${entry.id}`,
            entry,
          })),
        });
      }
      list.push({
        title: "Todos os módulos",
        rows: modules.map((entry) => ({
          kind: "module",
          key: `all:${entry.id}`,
          entry,
        })),
      });
    } else {
      if (filteredModules.length > 0) {
        list.push({
          title: `Módulos (${filteredModules.length})`,
          rows: filteredModules.map((entry) => ({
            kind: "module",
            key: `mod:${entry.id}`,
            entry,
          })),
        });
      }
      if (filteredActions.length > 0) {
        list.push({
          title: `Ações rápidas (${filteredActions.length})`,
          rows: filteredActions.map((entry) => ({
            kind: "action",
            key: `act:${entry.id}`,
            entry,
          })),
        });
      }
    }

    return list;
  }, [hasQuery, favoriteModules, recentModules, filteredActions, modules, filteredModules]);

  const flatRows = useMemo(
    () => sections.flatMap((section) => section.rows),
    [sections],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!flatRows.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flatRows.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flatRows.length) % flatRows.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = flatRows[activeIndex];
        if (!selected) return;
        if (selected.kind === "module") {
          onNavigate(selected.entry.id);
        } else {
          selected.entry.onSelect();
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatRows, activeIndex, onClose, onNavigate]);

  if (!open || typeof document === "undefined") return null;

  let runningIndex = -1;

  return createPortal(
    <div
      className="cmd-palette-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="cmd-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida de módulos e ações"
        data-testid="quick-command-palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cmd-palette-search">
          <Search size={18} className="cmd-palette-search__icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="cmd-palette-search__input"
            placeholder="Ir para módulo, reforma, TV, tema ou ação..."
            aria-label="Pesquisar módulos e ações"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="cmd-palette-search__clear"
              aria-label="Limpar busca rápida"
              onClick={() => setQuery("")}
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            className="cmd-palette-search__close"
            aria-label="Fechar busca rápida"
            onClick={onClose}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="cmd-palette-body" role="listbox" aria-label="Resultados da busca rápida">
          {flatRows.length === 0 ? (
            <div className="cmd-palette-empty">
              Nenhum módulo ou ação corresponde a &ldquo;{query}&rdquo;.
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="cmd-palette-group">
                <div className="cmd-palette-group__heading">
                  <span>{section.title}</span>
                  {section.title === "Favoritos" && <Star size={11} aria-hidden="true" />}
                  {section.title === "Recentes" && <Clock size={11} aria-hidden="true" />}
                  {section.title.startsWith("Ações") && <Sparkles size={11} aria-hidden="true" />}
                </div>
                {section.rows.map((row) => {
                  runningIndex += 1;
                  const idx = runningIndex;
                  const isFocused = idx === activeIndex;

                  if (row.kind === "module") {
                    const Icon = row.entry.icon;
                    const isPinned = favorites.includes(row.entry.id);
                    const isCurrent = currentPage === row.entry.id;
                    return (
                      <div
                        key={row.key}
                        className={`cmd-palette-row${isFocused ? " is-active" : ""}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={isFocused}
                          className="cmd-palette-item"
                          onClick={() => {
                            onNavigate(row.entry.id);
                            onClose();
                          }}
                        >
                          <span className="cmd-palette-item__icon" aria-hidden="true">
                            <Icon size={17} />
                          </span>
                          <span className="cmd-palette-item__copy">
                            <span className="cmd-palette-item__label">{row.entry.label}</span>
                            <span className="cmd-palette-item__meta">{row.entry.section}</span>
                          </span>
                          {isCurrent && (
                            <span className="cmd-palette-item__current">Atual</span>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`cmd-palette-star${isPinned ? " is-pinned" : ""}`}
                          aria-pressed={isPinned}
                          aria-label={
                            isPinned
                              ? `Remover ${row.entry.label} dos favoritos`
                              : `Fixar ${row.entry.label} nos favoritos`
                          }
                          title={isPinned ? "Remover dos favoritos" : "Fixar nos favoritos"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite(row.entry.id);
                          }}
                        >
                          <Star
                            size={15}
                            fill={isPinned ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    );
                  }

                  const ActionIcon = row.entry.icon;
                  return (
                    <div
                      key={row.key}
                      className={`cmd-palette-row${isFocused ? " is-active" : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={isFocused}
                        className="cmd-palette-item"
                        onClick={() => {
                          row.entry.onSelect();
                          onClose();
                        }}
                      >
                        <span className="cmd-palette-item__icon" aria-hidden="true">
                          <ActionIcon size={17} />
                        </span>
                        <span className="cmd-palette-item__copy">
                          <span className="cmd-palette-item__label">{row.entry.label}</span>
                          <span className="cmd-palette-item__meta">{row.entry.description}</span>
                        </span>
                        {row.entry.shortcut && (
                          <span className="cmd-palette-item__current">{row.entry.shortcut}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmd-palette-footer">
          <div className="cmd-palette-footer__hints">
            <span>
              <kbd>↑↓</kbd>Navegar
            </span>
            <span>
              <kbd>
                <CornerDownLeft size={10} aria-hidden="true" />
              </kbd>
              Abrir
            </span>
            <span>
              <kbd>Esc</kbd>Fechar
            </span>
          </div>
          <span>Fixe módulos frequentes na estrela</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
