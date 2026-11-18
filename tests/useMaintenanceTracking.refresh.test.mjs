import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const temp = await mkdtemp(path.resolve("tests/.tmp-maintenance-refresh-"));
const reactMock = path.join(temp, "react-mock.mjs");
const serviceMock = path.join(temp, "service-mock.mjs");
const reactSource = `
export function useState(initial) {
  const runner = globalThis.__hookRunner;
  const index = runner.stateIndex++;
  if (!(index in runner.states)) runner.states[index] = typeof initial === 'function' ? initial() : initial;
  return [runner.states[index], value => { runner.states[index] = typeof value === 'function' ? value(runner.states[index]) : value; }];
}
export function useRef(initial) {
  const runner = globalThis.__hookRunner;
  const index = runner.refIndex++;
  if (!(index in runner.refs)) runner.refs[index] = { current: initial };
  return runner.refs[index];
}
export function useCallback(fn) { return fn; }
export function useEffect(fn) {
  const runner = globalThis.__hookRunner;
  if (!runner.effectRan) { runner.effectRan = true; runner.cleanup = fn() || (() => {}); }
}
`;
const serviceSource = `
export async function syncApoio() {
  const state = globalThis.__maintenanceMock;
  state.syncs += 1;
  if (state.syncError) throw new Error('sync falhou');
}
export async function loadMaintenanceData() {
  const state = globalThis.__maintenanceMock;
  state.reads += 1;
  if (state.readError) throw new Error('read falhou');
  if (state.pending) return new Promise(resolve => { state.resolveRead = resolve; });
  return state.data;
}
`;
await writeFile(reactMock, reactSource);
await writeFile(serviceMock, serviceSource);

let now = 1_000_000;
const intervals = [];
const timeouts = new Map();
let nextTimer = 1;
globalThis.Date.now = () => now;
globalThis.window = {
  setInterval(fn) { intervals.push(fn); return intervals.length; },
  clearInterval() {},
  setTimeout(fn) { const id = nextTimer++; timeouts.set(id, fn); return id; },
  clearTimeout(id) { timeouts.delete(id); },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
};
globalThis.document = {
  visibilityState: "visible",
  addEventListener() {},
  removeEventListener() {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

globalThis.__maintenanceMock = {
  syncs: 0,
  reads: 0,
  syncError: false,
  readError: false,
  pending: false,
  resolveRead: null,
  data: { groups: [], fleets: [], orders: [], sync: { sincronizado_em: "2026-11-08T12:00:00Z" }, role: "viewer" },
};
globalThis.__hookRunner = {
  states: [],
  refs: [],
  stateIndex: 0,
  refIndex: 0,
  effectRan: false,
  cleanup: () => {},
};

try {
  await build({
    entryPoints: ["src/hooks/useMaintenanceTracking.ts"],
    outfile: path.join(temp, "hook.mjs"),
    bundle: true,
    format: "esm",
    platform: "node",
    plugins: [{
      name: "hook-mocks",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^react$/ }, () => ({ path: reactMock }));
        buildApi.onResolve({ filter: /apoioService$/ }, () => ({ path: serviceMock }));
        buildApi.onResolve({ filter: /maintenanceTrackingService$/ }, () => ({ path: serviceMock }));
      },
    }],
  });
  const hook = await import(pathToFileURL(path.join(temp, "hook.mjs")));
  const render = (options) => {
    globalThis.__hookRunner.stateIndex = 0;
    globalThis.__hookRunner.refIndex = 0;
    return hook.useMaintenanceTracking(options);
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));

  let result = render({ automaticRefreshMs: hook.MAINTENANCE_CENTRAL_REFRESH_MS, syncOnAutomaticRefresh: false });
  await flush();
  result = render({ automaticRefreshMs: hook.MAINTENANCE_CENTRAL_REFRESH_MS, syncOnAutomaticRefresh: false });
  assert.equal(globalThis.__maintenanceMock.syncs, 0, "leitura inicial da Central prioriza READ");
  assert.equal(globalThis.__maintenanceMock.reads, 1, "leitura inicial ocorre uma vez");

  await result.refresh();
  await flush();
  assert.equal(globalThis.__maintenanceMock.syncs, 1, "refresh manual sincroniza Edge");
  assert.equal(globalThis.__maintenanceMock.reads, 2, "refresh manual lê a fotografia");

  now += hook.MAINTENANCE_CENTRAL_REFRESH_MS - 1;
  intervals[0]();
  await flush();
  assert.equal(globalThis.__maintenanceMock.reads, 2, "visibilidade/intervallo respeita a cadência");
  now += 1;
  intervals[0]();
  await flush();
  assert.equal(globalThis.__maintenanceMock.reads, 3, "após cinco minutos há uma única leitura");
  assert.equal(globalThis.__maintenanceMock.syncs, 1, "refresh automático da Central não chama Edge");

  globalThis.__maintenanceMock.pending = true;
  const concurrent = result.refresh();
  const ignored = result.refresh();
  await flush();
  assert.equal(globalThis.__maintenanceMock.reads, 4, "uma leitura pode estar em voo");
  assert.strictEqual(globalThis.__maintenanceMock.resolveRead !== null, true);
  globalThis.__maintenanceMock.resolveRead(globalThis.__maintenanceMock.data);
  await Promise.all([concurrent, ignored]);
  globalThis.__maintenanceMock.pending = false;

  globalThis.__maintenanceMock.readError = true;
  await result.refresh();
  await flush();
  result = render({ automaticRefreshMs: hook.MAINTENANCE_CENTRAL_REFRESH_MS, syncOnAutomaticRefresh: false });
  assert.equal(result.data?.sync?.sincronizado_em, "2026-11-08T12:00:00Z", "falha mantém a última fotografia válida");
  assert.match(result.error, /read falhou/, "falha de leitura fica visível");

  globalThis.__hookRunner.cleanup();
  globalThis.__maintenanceMock.syncs = 0;
  globalThis.__maintenanceMock.reads = 0;
  globalThis.__maintenanceMock.readError = false;
  globalThis.__hookRunner = { states: [], refs: [], stateIndex: 0, refIndex: 0, effectRan: false, cleanup: () => {} };
  now += 1;
  render();
  await flush();
  assert.equal(globalThis.__maintenanceMock.syncs, 1, "outros módulos mantêm sync Edge inicial");
  assert.equal(globalThis.__maintenanceMock.reads, 1, "outros módulos mantêm READ inicial");
  const defaultInterval = intervals.at(-1);
  now += hook.MAINTENANCE_DEFAULT_REFRESH_MS - 1;
  defaultInterval();
  await flush();
  assert.equal(globalThis.__maintenanceMock.reads, 1, "padrão não antecipa a leitura de 60s");
  now += 1;
  defaultInterval();
  await flush();
  assert.equal(globalThis.__maintenanceMock.syncs, 2, "padrão mantém Edge no ciclo automático");
  assert.equal(globalThis.__maintenanceMock.reads, 2, "padrão mantém READ no ciclo automático");
  globalThis.__hookRunner.cleanup();
  console.log("OK: useMaintenanceTracking — Central READ inicial/automático em 5min, manual Edge+READ, sem concorrência, snapshot preservado, timers limpos e padrão 60s preservado.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
