import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildDashboardFocusCopyText,
  buildDashboardFocusDetail,
  formatFocusDateBr,
  getAdjacentFocusOrder,
} from "../src/lib/dashboardFocusMode";
import type { Programacao } from "../src/types";

const ROOT = path.resolve(import.meta.dirname, "..");

function makeSchedule(overrides: Partial<Programacao> = {}): Programacao {
  return {
    id: "ord-1",
    frota: "4588",
    descricaoPonto: "LAVADOR",
    tipoPreventiva: "Lavagem / Lubrificação",
    dataProgramada: "2026-11-16",
    dataRealizada: "",
    situacao: "ATRASADO",
    horarioAgendado: "07:00",
    observacao: "Oficina Henrique.",
    origemRegistro: "PCM",
    numeroOS: "159334775",
    apoioNome: "Caminhões Pipa",
    statusPCM: "Andamento",
    narrativaPCM: "Lavagem completa e revisão de pontos de graxa.",
    ...overrides,
  };
}

test("buildDashboardFocusDetail computes overdue days, urgency tone, narrative, and recent fleet history", () => {
  const today = new Date(2026, 10, 19, 10, 0, 0); // 19/11/2026
  const current = makeSchedule({ id: "ord-1", frota: "4588", dataProgramada: "2026-11-16" });
  const historyOld = makeSchedule({
    id: "ord-0",
    frota: "4588",
    dataProgramada: "2026-11-01",
    dataRealizada: "2026-11-02",
    situacao: "ENCERRADO",
  });
  const otherFleet = makeSchedule({
    id: "ord-other",
    frota: "9999",
    dataProgramada: "2026-11-18",
  });

  const detail = buildDashboardFocusDetail(
    current,
    "atrasados",
    [current, historyOld, otherFleet],
    today,
  );

  assert.equal(detail.urgencyTone, "overdue");
  assert.equal(detail.daysDelta, -3);
  assert.equal(detail.urgencyText, "Em atraso há 3 dias");
  assert.equal(detail.formattedProgramada, "16/11/2026");
  assert.equal(detail.formattedRealizada, "Pendente");
  assert.equal(detail.originLabel, "Integração PCM");
  assert.match(detail.narrativeText, /Oficina Henrique\./);
  assert.match(detail.narrativeText, /revisão de pontos de graxa/);
  assert.equal(detail.recentFleetHistory.length, 1);
  assert.equal(detail.recentFleetHistory[0].id, "ord-0");
  assert.equal(detail.recentFleetHistory[0].dataFormatted, "02/11/2026");

  const copy = buildDashboardFocusCopyText(detail);
  assert.match(copy, /Frota 4588 · OS 159334775/);
  assert.match(copy, /Em atraso há 3 dias/);
});

test("buildDashboardFocusDetail handles today, upcoming, and completed states plus date formatting", () => {
  const today = new Date(2026, 10, 19, 10, 0, 0);

  const dueToday = buildDashboardFocusDetail(
    makeSchedule({
      id: "ord-today",
      situacao: "PROGRAMADO",
      dataProgramada: "2026-11-19",
      horarioAgendado: "14:00",
      origemRegistro: "MANUAL",
      observacao: "",
      narrativaPCM: "",
    }),
    "proximos7",
    [],
    today,
  );
  assert.equal(dueToday.urgencyTone, "today");
  assert.equal(dueToday.urgencyText, "Agendada para hoje às 14:00");
  assert.equal(dueToday.originLabel, "Cadastro Manual");

  const upcoming = buildDashboardFocusDetail(
    makeSchedule({
      id: "ord-up",
      situacao: "PROGRAMADO",
      dataProgramada: "2026-11-23",
    }),
    "proximos7",
    [],
    today,
  );
  assert.equal(upcoming.urgencyTone, "upcoming");
  assert.equal(upcoming.urgencyText, "Programada para daqui a 4 dias");

  assert.equal(formatFocusDateBr(""), "Não informada");
  assert.equal(formatFocusDateBr("2026-11-19"), "19/11/2026");
});

test("getAdjacentFocusOrder cycles prev and next cleanly across queue boundaries", () => {
  const list = [
    makeSchedule({ id: "a" }),
    makeSchedule({ id: "b" }),
    makeSchedule({ id: "c" }),
  ];

  assert.equal(getAdjacentFocusOrder(list, "a", "next")?.id, "b");
  assert.equal(getAdjacentFocusOrder(list, "c", "next")?.id, "a");
  assert.equal(getAdjacentFocusOrder(list, "a", "prev")?.id, "c");
  assert.equal(getAdjacentFocusOrder([list[0]], "a", "next"), null);
});

test("Dashboard Focus Mode defines CSS fade-in-up animation, floating close button, and semantic wiring", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/styles/dashboard-focus-mode.css"), "utf8");
  const modalTsx = fs.readFileSync(path.join(ROOT, "src/components/DashboardFocusModal.tsx"), "utf8");
  const dashboardTsx = fs.readFileSync(path.join(ROOT, "src/pages/Dashboard.tsx"), "utf8");

  assert.match(css, /@keyframes fade-in-up\s*\{/);
  assert.match(css, /\.dash-focus-card\.animate-fade-in-up/);
  assert.match(css, /\.dash-focus-floating-close\s*\{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

  assert.match(modalTsx, /data-testid="dashboard-focus-overlay"/);
  assert.match(modalTsx, /className="dash-focus-floating-close"/);
  assert.match(modalTsx, /aria-label="Fechar modo foco"/);
  assert.match(modalTsx, /animate-fade-in-up/);

  assert.match(dashboardTsx, /import DashboardFocusModal from '\.\.\/components\/DashboardFocusModal'/);
  assert.match(dashboardTsx, /openFocusOrder\(s, 'atrasados'/);
  assert.match(dashboardTsx, /openFocusOrder\(s, 'proximos7'/);
  assert.match(dashboardTsx, /<DashboardFocusModal/);
});
