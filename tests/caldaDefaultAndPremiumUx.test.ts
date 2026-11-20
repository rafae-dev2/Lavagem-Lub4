import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FAVORITE_PAGES_STORAGE_KEY,
  MAX_RECENT_PAGES,
  RECENT_PAGES_STORAGE_KEY,
  filterCommandActions,
  filterCommandModules,
  normalizeCommandQuery,
  readFavoritePages,
  readRecentPages,
  recordRecentPage,
  toggleFavoritePage,
  type CommandPaletteModuleItem,
  type StorageLike,
} from "../src/lib/quickCommandPalette";
import {
  buildTrackingDossierCopyText,
  classifyTrackingRow,
  filterTrackingPanelRows,
  groupTrackingPanelRows,
  summarizeTrackingPanelMetrics,
} from "../src/lib/trackingOperationalPanel";
import type { TrackingRow } from "../src/lib/maintenanceTracking";
import type { PageType } from "../src/types";

const ROOT = path.resolve(import.meta.dirname, "..");

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

function makeTrackingRow(overrides: Partial<TrackingRow> = {}): TrackingRow {
  return {
    chave: "chave-1",
    frota: "4102",
    os: "15933001",
    equipamento: "Carreta Rodomuda",
    modelo: "Rodomuda 2024",
    apoio: "Carretas Rodomuda",
    grupo_fonte: "RODOMUDA",
    origem: "interno",
    prestador: "Oficina Central",
    setor: "Caldeiraria",
    ponto: "Box 3",
    motivo: "Reforma estrutural",
    narrativa: "Reforma completa do chassi e pintura industrial.",
    status: "EM ANDAMENTO",
    entrada: "2026-11-10",
    previsao: "2026-11-25",
    primeira_vista: "2026-11-10T08:00:00Z",
    ultima_vista: "2026-11-19T12:00:00Z",
    trackingStatus: "andamento",
    classificationReason: "Reforma identificada no cadastro Apoio",
    overdue: false,
    ...overrides,
  };
}

test("Calda App Glass is configured as the default theme across ThemeContext and index.html", () => {
  const themeCtx = fs.readFileSync(path.join(ROOT, "src/contexts/ThemeContext.tsx"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const layoutTsx = fs.readFileSync(path.join(ROOT, "src/components/Layout.tsx"), "utf8");

  assert.match(themeCtx, /const DEFAULT_THEME: Theme = 'calda';/);
  assert.match(themeCtx, /const THEME_DEFAULT_VERSION = 'calda-v10\.30';/);
  assert.match(themeCtx, /DEFAULT_THEME_INFO/);

  assert.match(indexHtml, /<html lang="pt-BR" class="dark theme-calda">/);
  assert.match(indexHtml, /<meta name="theme-color" content="#2a2c2f" \/>/);
  assert.match(indexHtml, /v === 'calda-v10\.30'.*:\s*'calda'/);

  assert.match(layoutTsx, /t\.key === "calda"[\s\S]*?Padrão/);
});

test("quickCommandPalette normalizes accents, scores module queries, and filters quick actions", () => {
  assert.equal(normalizeCommandQuery("  Lubrificação — Canavieiras  "), "lubrificacao — canavieiras");

  const modules: CommandPaletteModuleItem[] = [
    { id: "central-gerencial", label: "Central Gerencial", section: "Inteligência Gerencial", keywords: ["bi", "kpi"] },
    { id: "programacoes", label: "Lavagem / Lubrificação", section: "Rotina de Frotas", keywords: ["oleo", "troca"] },
    { id: "reformas-rodomuda", label: "Reforma — Carretas Rodomuda", section: "Controle de Reformas" },
    { id: "reformas-colhedoras", label: "Reforma — Colhedoras", section: "Controle de Reformas" },
  ];

  const rodomuda = filterCommandModules(modules, "rodomuda");
  assert.equal(rodomuda.length, 1);
  assert.equal(rodomuda[0].id, "reformas-rodomuda");

  const lub = filterCommandModules(modules, "lubrificacao oleo");
  assert.equal(lub.length, 1);
  assert.equal(lub[0].id, "programacoes");

  // Favorites receive a ranking boost when multiple items match
  const reformasFav = filterCommandModules(modules, "reforma", ["reformas-colhedoras"]);
  assert.equal(reformasFav[0].id, "reformas-colhedoras");

  const actions = filterCommandActions(
    [
      { id: "sync", label: "Sincronizar dados agora", description: "Atualiza Supabase", keywords: ["refresh"] },
      { id: "mobile", label: "Ativar Modo Celular", description: "Barra inferior", keywords: ["app"] },
    ],
    "celular app",
  );
  assert.deepEqual(actions.map((a) => a.id), ["mobile"]);
});

test("quickCommandPalette persists favorite toggles and caps recent pages cleanly", () => {
  const validIds: PageType[] = [
    "central-gerencial",
    "controle-apoio",
    "programacoes",
    "reformas-rodomuda",
    "reformas-colhedoras",
    "configuracoes",
  ];
  const storage = createMemoryStorage();

  let favs = toggleFavoritePage([], "reformas-rodomuda", storage);
  assert.deepEqual(favs, ["reformas-rodomuda"]);
  assert.deepEqual(readFavoritePages(validIds, storage), ["reformas-rodomuda"]);

  favs = toggleFavoritePage(favs, "controle-apoio", storage);
  assert.deepEqual(favs, ["controle-apoio", "reformas-rodomuda"]);

  favs = toggleFavoritePage(favs, "reformas-rodomuda", storage);
  assert.deepEqual(favs, ["controle-apoio"]);
  assert.equal(storage.getItem(FAVORITE_PAGES_STORAGE_KEY), JSON.stringify(["controle-apoio"]));

  let recents: PageType[] = [];
  for (const page of validIds) {
    recents = recordRecentPage(recents, page, storage);
  }
  assert.equal(recents.length, MAX_RECENT_PAGES);
  assert.equal(recents[0], "configuracoes");
  assert.equal(recents.includes("central-gerencial"), false);
  assert.deepEqual(readRecentPages(validIds, storage), recents);
  assert.ok(storage.getItem(RECENT_PAGES_STORAGE_KEY));
});

test("trackingOperationalPanel classifies urgency, computes SLA progress, filters, and groups buckets", () => {
  const clock = new Date(2026, 10, 19, 10, 0, 0); // 19/11/2026
  const rows: TrackingRow[] = [
    makeTrackingRow({
      chave: "r-overdue",
      frota: "4101",
      os: "1001",
      entrada: "2026-11-01",
      previsao: "2026-11-15",
      trackingStatus: "andamento",
      overdue: true,
      origem: "externo",
      prestador: "Metalúrgica Silva",
    }),
    makeTrackingRow({
      chave: "r-progress",
      frota: "4102",
      os: "1002",
      entrada: "2026-11-10",
      previsao: "2026-11-28",
      trackingStatus: "andamento",
      overdue: false,
      origem: "interno",
      prestador: "Oficina Central",
    }),
    makeTrackingRow({
      chave: "r-scheduled",
      frota: "4103",
      os: "1003",
      entrada: "2026-11-18",
      previsao: "2026-11-26",
      trackingStatus: "programado",
      overdue: false,
      origem: "interno",
      prestador: "Oficina Central",
    }),
    makeTrackingRow({
      chave: "r-closed",
      frota: "4104",
      os: "1004",
      entrada: "2026-11-02",
      previsao: "2026-11-10",
      trackingStatus: "encerrado",
      overdue: false,
      origem: "interno",
      prestador: "Oficina Central",
    }),
  ];

  const overdueClassified = classifyTrackingRow(rows[0], clock);
  assert.equal(overdueClassified.tier, "overdue");
  assert.equal(overdueClassified.isExternal, true);
  assert.equal(overdueClassified.daysOpen, 18);
  assert.equal(overdueClassified.forecastDeltaDays, -4);
  assert.equal(overdueClassified.slaProgressPct, 100);

  const progressClassified = classifyTrackingRow(rows[1], clock);
  assert.equal(progressClassified.tier, "progress");
  assert.equal(progressClassified.daysOpen, 9);
  assert.equal(progressClassified.slaProgressPct, 50);

  const metrics = summarizeTrackingPanelMetrics(rows, clock);
  assert.equal(metrics.total, 4);
  assert.equal(metrics.overdueCount, 1);
  assert.equal(metrics.inProgressCount, 2);
  assert.equal(metrics.scheduledCount, 1);
  assert.equal(metrics.externalCount, 1);
  assert.equal(metrics.closedCount, 1);
  assert.equal(metrics.distinctFleets, 4);

  assert.equal(filterTrackingPanelRows(rows, "overdue", clock).length, 1);
  assert.equal(filterTrackingPanelRows(rows, "scheduled", clock).length, 1);
  assert.equal(filterTrackingPanelRows(rows, "external", clock).length, 1);

  const byPriority = groupTrackingPanelRows(rows, "priority", clock);
  assert.deepEqual(byPriority.map((b) => b.id), ["overdue", "progress", "scheduled", "closed"]);

  const byProvider = groupTrackingPanelRows(rows, "provider", clock);
  // Metalúrgica Silva has 1 overdue so it ranks first ahead of Oficina Central
  assert.equal(byProvider[0].label, "Metalúrgica Silva");
  assert.equal(byProvider[0].overdueCount, 1);

  const summaryText = buildTrackingDossierCopyText(overdueClassified);
  assert.match(summaryText, /Frota 4101 · OS 1001/);
  assert.match(summaryText, /Metalúrgica Silva/);
});

test("Layout wires QuickCommandPalette (Ctrl+K) and AcompanhamentoManutencao wires TrackingOperationalPanel", () => {
  const layoutTsx = fs.readFileSync(path.join(ROOT, "src/components/Layout.tsx"), "utf8");
  const trackingTsx = fs.readFileSync(path.join(ROOT, "src/pages/AcompanhamentoManutencao.tsx"), "utf8");

  assert.match(layoutTsx, /<QuickCommandPalette/);
  assert.match(layoutTsx, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(layoutTsx, /shell-cmd-trigger/);
  assert.match(layoutTsx, /Favoritos fixados/);

  assert.match(trackingTsx, /import TrackingOperationalPanel from "\.\.\/components\/TrackingOperationalPanel"/);
  assert.match(trackingTsx, /useState<"cards" \| "panel" \| "table">/);
  assert.match(trackingTsx, /Visualizar em painel operacional/);
  assert.match(trackingTsx, /<TrackingOperationalPanel rows=\{rows\} clock=\{clock\} \/>/);
});
