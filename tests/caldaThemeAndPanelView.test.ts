import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CALDA_MOBILE_MODE_STORAGE_KEY,
  CALDA_PRIMARY_DOCK_ITEMS,
  isCaldaPrimaryPage,
  readStoredCaldaMobileMode,
  resolveCaldaActiveDockId,
  resolveCaldaShellPresentation,
  saveStoredCaldaMobileMode,
} from '../src/lib/caldaAppMode';
import {
  classifyApoioOrderUrgency,
  groupApoioOrdersForPanel,
  summarizeApoioPanelMetrics,
} from '../src/lib/apoioOperationalBoard';
import type { ApoioReportRow } from '../src/types/apoio';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

function makeRow(overrides: Partial<ApoioReportRow>): ApoioReportRow {
  return {
    chave: 'row-1',
    frota: '15101',
    os: '159325249',
    equipamento: 'Área de Vivência',
    modelo: 'Rodot.Car.Baú',
    apoio: 'Área de Vivência',
    grupo_fonte: 'Carretas Área de Vivência',
    origem: 'campo',
    prestador: '',
    setor: 'Ofc.Elétrica',
    ponto: 'Kango Elét 8838',
    status: 'Programada',
    entrada: '2026-10-08T14:45:00Z',
    previsao: '2026-12-10T23:00:00Z',
    narrativa: 'Serviço programado na frota',
    ativo: true,
    primeira_vista: '2026-10-08T15:00:00Z',
    ultima_vista: '2026-11-19T17:00:00Z',
    ausente_desde: null,
    ...overrides,
  } as ApoioReportRow;
}

test('caldaAppMode maps primary pages, Lavagem subpages, and secondary pages to the 5 bottom dock slots', () => {
  assert.equal(CALDA_PRIMARY_DOCK_ITEMS.length, 5);
  assert.equal(resolveCaldaActiveDockId('central-gerencial'), 'central-gerencial');
  assert.equal(resolveCaldaActiveDockId('gestao-ordens-manutencao'), 'gestao-ordens-manutencao');
  assert.equal(resolveCaldaActiveDockId('controle-apoio'), 'controle-apoio');
  assert.equal(resolveCaldaActiveDockId('programacoes'), 'programacoes');
  assert.equal(resolveCaldaActiveDockId('dashboard'), 'programacoes');
  assert.equal(resolveCaldaActiveDockId('calendario'), 'more');
  assert.equal(resolveCaldaActiveDockId('reformas-apoio'), 'more');
  assert.equal(resolveCaldaActiveDockId('configuracoes'), 'more');
  assert.equal(isCaldaPrimaryPage('controle-apoio'), true);
  assert.equal(isCaldaPrimaryPage('calendario'), false);
});

test('resolveCaldaShellPresentation switches cleanly between desktop dock, desktop Modo Celular phone frame, and mobile App Mode', () => {
  // Non-Calda themes keep standard shell completely unchanged
  const nonCalda = resolveCaldaShellPresentation({ isCalda: false, isMobileViewport: false, desktopMobileMode: true });
  assert.deepEqual(nonCalda, {
    isCaldaActive: false,
    isMobileAppMode: false,
    isDesktopPhoneFrame: false,
    showBottomTabBar: false,
    showDesktopTopDock: false,
    showDesktopMobileToggle: false,
    showSidebar: true,
  });

  // Calda on desktop (normal): floating top dock + Modo Celular toggle button
  const desktopNormal = resolveCaldaShellPresentation({ isCalda: true, isMobileViewport: false, desktopMobileMode: false });
  assert.equal(desktopNormal.showDesktopTopDock, true);
  assert.equal(desktopNormal.showDesktopMobileToggle, true);
  assert.equal(desktopNormal.showBottomTabBar, false);
  assert.equal(desktopNormal.isDesktopPhoneFrame, false);

  // Calda on desktop with Modo Celular active: centered phone frame + floating bottom tabbar
  const desktopPhone = resolveCaldaShellPresentation({ isCalda: true, isMobileViewport: false, desktopMobileMode: true });
  assert.equal(desktopPhone.isDesktopPhoneFrame, true);
  assert.equal(desktopPhone.isMobileAppMode, true);
  assert.equal(desktopPhone.showBottomTabBar, true);
  assert.equal(desktopPhone.showDesktopTopDock, false);

  // Calda on mobile viewport: automatic App Mode with bottom tabbar, no desktop phone frame wrapper
  const mobileApp = resolveCaldaShellPresentation({ isCalda: true, isMobileViewport: true, desktopMobileMode: false });
  assert.equal(mobileApp.isMobileAppMode, true);
  assert.equal(mobileApp.isDesktopPhoneFrame, false);
  assert.equal(mobileApp.showBottomTabBar, true);
  assert.equal(mobileApp.showDesktopMobileToggle, false);
});

test('calda desktop mobile mode storage persists and restores safely', () => {
  const map = new Map<string, string>();
  const fakeStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
  assert.equal(readStoredCaldaMobileMode(fakeStorage), false);
  saveStoredCaldaMobileMode(true, fakeStorage);
  assert.equal(map.get(CALDA_MOBILE_MODE_STORAGE_KEY), '1');
  assert.equal(readStoredCaldaMobileMode(fakeStorage), true);
  saveStoredCaldaMobileMode(false, fakeStorage);
  assert.equal(readStoredCaldaMobileMode(fakeStorage), false);
});

test('apoioOperationalBoard classifies urgency, summarizes counts, and groups orders by priority, status, and group', () => {
  const now = new Date('2026-11-19T18:00:00Z');
  const rows: ApoioReportRow[] = [
    makeRow({
      chave: 'scheduled-ok',
      frota: '15102',
      status: 'Programada',
      entrada: '2026-11-15T10:00:00Z',
      previsao: '2026-12-05T18:00:00Z',
      apoio: 'Área de Vivência',
    }),
    makeRow({
      chave: 'overdue-old',
      frota: '15101',
      status: 'Programada',
      entrada: '2026-10-08T14:45:00Z',
      previsao: '2026-10-30T23:00:00Z',
      apoio: 'Área de Vivência',
    }),
    makeRow({
      chave: 'progress-ext',
      frota: '4508',
      status: 'Em andamento',
      origem: 'externa',
      prestador: 'Fratini',
      entrada: '2026-11-10T10:00:00Z',
      previsao: '2026-12-01T18:00:00Z',
      apoio: 'Caminhões',
    }),
  ];

  const classifiedOverdue = classifyApoioOrderUrgency(rows[1], now);
  assert.equal(classifiedOverdue.tier, 'overdue');
  assert.equal(classifiedOverdue.overdue, true);

  const summary = summarizeApoioPanelMetrics(rows, now);
  assert.equal(summary.total, 3);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.scheduledCount, 2);
  assert.equal(summary.externalCount, 1);

  const byPriority = groupApoioOrdersForPanel(rows, 'priority', now);
  assert.equal(byPriority[0].id, 'overdue');
  assert.equal(byPriority[0].items[0].row.frota, '15101');
  assert.equal(byPriority[1].id, 'progress');
  assert.equal(byPriority[2].id, 'scheduled');

  const byStatus = groupApoioOrdersForPanel(rows, 'status', now);
  assert.equal(byStatus[0].id, 'andamento');
  assert.equal(byStatus[1].id, 'programado');
  // Within Programadas, overdue order surfaces first
  assert.equal(byStatus[1].items[0].row.frota, '15101');

  const byGroup = groupApoioOrdersForPanel(rows, 'group', now);
  // Group with overdue order surfaces first
  assert.equal(byGroup[0].title, 'Área de Vivência');
  assert.equal(byGroup[0].overdueCount, 1);

  // Edge case: inactive order with missing ultima_vista or empty entrada must never throw (diasObservados === null)
  const edgeRow = makeRow({
    chave: 'edge-1',
    frota: '99999',
    ativo: false,
    entrada: '',
    ultima_vista: '',
    previsao: '',
    origem: '',
  });
  const classifiedEdge = classifyApoioOrderUrgency(edgeRow, now);
  assert.equal(classifiedEdge.days, null);
  assert.equal(classifiedEdge.local, 'Origem não informada');
});

test('Calda App Glass theme is registered cleanly and scoped strictly to html.theme-calda', () => {
  const themeCtx = read('src/contexts/ThemeContext.tsx');
  const indexHtml = read('index.html');
  const mainTsx = read('src/main.tsx');
  const caldaCss = read('src/styles/calda.css');
  const layoutTsx = read('src/components/Layout.tsx');
  const apoioTsx = read('src/pages/ControleApoio.tsx');

  assert.match(themeCtx, /key:\s*'calda'/);
  assert.match(themeCtx, /theme-calda/);
  assert.match(indexHtml, /calda:\s*1/);
  assert.match(indexHtml, /theme-calda/);
  assert.match(mainTsx, /import\s+'\.\/styles\/calda\.css'/);

  // Calda CSS signature tokens: Urbanist font, smoked glass, pure white active pill, floating tabbar, phone frame
  assert.match(caldaCss, /--calda-font:\s*"Urbanist"/);
  assert.match(caldaCss, /--calda-pill-bg:\s*#f6f7f8/);
  assert.match(caldaCss, /--calda-sig:\s*#1e9bf0/);
  assert.match(caldaCss, /\.calda-tabbar\s*\{/);
  assert.match(caldaCss, /\.app-shell--calda-phone-frame/);

  // Layout wires Calda top dock, bottom tabbar, Modo Celular toggle, and Mais bottom sheet
  assert.match(layoutTsx, /calda-top-dock/);
  assert.match(layoutTsx, /calda-tabbar/);
  assert.match(layoutTsx, /Modo Celular/);
  assert.match(layoutTsx, /calda-more-sheet/);

  // ControleApoio wires Painel operational view mode
  assert.match(apoioTsx, /ApoioOrdersPanelView/);
  assert.match(apoioTsx, /displayMode === 'panel'/);
});
