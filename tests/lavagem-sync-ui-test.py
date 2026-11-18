#!/usr/bin/env python3
"""Teste de UI isolado para o hook real useSchedules.

O teste não chama Supabase nem Apps Script: o Playwright intercepta os dois
módulos importados pelo Vite e fornece mocks ESM controlados pela página.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import traceback
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("LAVAGEM_SYNC_BASE_URL", "http://127.0.0.1:3000")
CHROMIUM = os.environ.get("LAVAGEM_SYNC_CHROMIUM", "/usr/bin/chromium")
VITE_PORT = int(os.environ.get("LAVAGEM_SYNC_PORT", "3000"))

INITIAL_ROWS = [
    {
        "id": "lav-6608",
        "frota": "PCM-6608",
        "descricaoPonto": "LAVADOR",
        "tipoPreventiva": "Lavagem / Lubrificação",
        "dataProgramada": "2026-11-06",
        "dataRealizada": "",
        "situacao": "ANDAMENTO",
        "horarioAgendado": "08:00",
        "observacao": "Amostra fictícia PCM 6608",
        "rowIndex": 6608,
        "origemRegistro": "PCM",
        "pcmChave": "pcm-6608",
        "numeroOS": "OS-6608",
    },
    {
        "id": "lav-4626",
        "frota": "PCM-4626",
        "descricaoPonto": "LAVADOR",
        "tipoPreventiva": "Lavagem / Lubrificação",
        "dataProgramada": "2026-11-06",
        "dataRealizada": "",
        "situacao": "ANDAMENTO",
        "horarioAgendado": "09:00",
        "observacao": "Amostra fictícia PCM 4626",
        "rowIndex": 4626,
        "origemRegistro": "PCM",
        "pcmChave": "pcm-4626",
        "numeroOS": "OS-4626",
    },
]

SHEETS_MODULE = r"""
const state = globalThis.__lavagemSyncMock || (globalThis.__lavagemSyncMock = {});
state.fetches = state.fetches || [];
state.pendingFetches = state.pendingFetches || {};
state.writes = state.writes || [];
state.nextFetchId = state.nextFetchId || 0;

const cloneRows = (rows) => (rows || []).map((row) => ({ ...row }));

state.resolveFetch = (id, rows) => {
  const pending = state.pendingFetches[String(id)];
  if (!pending) return false;
  delete state.pendingFetches[String(id)];
  pending.resolve(cloneRows(rows === undefined ? pending.snapshot : rows));
  return true;
};
state.configureNextDeferred = (rows) => {
  state.deferNextFetch = true;
  state.deferredRows = cloneRows(rows);
};
state.setServerRows = (rows) => {
  state.serverRows = cloneRows(rows);
};
state.pendingFetchIds = () => Object.keys(state.pendingFetches).map(Number);

export async function fetchSchedules(options = {}) {
  const id = ++state.nextFetchId;
  const fresh = Boolean(options && options.fresh);
  // O hook passa AbortSignal para cancelar leituras antigas. O mock mantém
  // o contrato e registra o fato, mas deliberadamente não cancela a Promise:
  // os testes precisam liberar respostas stale de forma determinística.
  const signal = options && options.signal;
  const deferred = Boolean(state.deferNextFetch);
  const snapshot = cloneRows(
    deferred ? (state.deferredRows || state.serverRows) : state.serverRows,
  );
  state.fetches.push({ id, fresh, deferred, hasSignal: Boolean(signal), startedAt: Date.now() });

  if (deferred) {
    state.deferNextFetch = false;
    state.deferredRows = null;
    return new Promise((resolve) => {
      state.pendingFetches[String(id)] = { resolve, snapshot };
    });
  }
  return snapshot;
}

export async function appendRowToSheet(item) {
  state.writes.push({ kind: 'append', item: { ...item } });
  return { success: true, rowIndex: item.rowIndex || 9999 };
}

export async function updateRowInSheet(rowIndex, item, changes) {
  state.writes.push({ kind: 'update', rowIndex, item: { ...item }, changes: { ...changes } });
  return { success: true };
}

export async function deleteRowFromSheet(rowIndex) {
  state.writes.push({ kind: 'delete', rowIndex });
  return { success: true };
}
"""

SUPABASE_MODULE = r"""
const state = globalThis.__lavagemSyncMock || (globalThis.__lavagemSyncMock = {});
state.channels = state.channels || [];
state.removedChannels = state.removedChannels || 0;

state.emitStatus = (status) => {
  for (const record of state.channels) {
    if (record.active && record.statusCallback) record.statusCallback(status);
  }
};
state.emitRealtime = (payload = { eventType: 'UPDATE' }) => {
  for (const record of state.channels) {
    if (record.active && record.eventCallback) record.eventCallback(payload);
  }
};

export const LAVAGEM_TABLE = 'lavagem_lubrificacao';
export const SUPABASE_URL = 'http://lavagem-sync.mock';
export const SUPABASE_ANON_KEY = 'lavagem-sync-test-key';

export const supabase = {
  channel(name) {
    const record = {
      name,
      active: true,
      eventCallback: null,
      statusCallback: null,
      api: null,
    };
    const api = {
      on(_event, _filter, callback) {
        record.eventCallback = callback;
        return api;
      },
      subscribe(callback) {
        record.statusCallback = callback;
        return api;
      },
    };
    record.api = api;
    state.channels.push(record);
    return api;
  },
  removeChannel(channel) {
    const record = state.channels.find((candidate) => candidate.api === channel);
    if (record) {
      record.active = false;
      state.removedChannels += 1;
    }
    return Promise.resolve('ok');
  },
};
"""


def closed_rows() -> list[dict[str, object]]:
    return [
        {
            **row,
            "situacao": "ENCERRADO",
            "dataRealizada": "2026-11-06",
            "observacao": f"{row['observacao']} — encerrado no servidor",
        }
        for row in INITIAL_ROWS
    ]


def stale_rows() -> list[dict[str, object]]:
    return [
        {
            **row,
            "situacao": "ANDAMENTO",
            "dataRealizada": "",
        }
        for row in INITIAL_ROWS
    ]


def mock_init_script() -> str:
    return f"""
(() => {{
  const rows = {json.dumps(INITIAL_ROWS, ensure_ascii=False)};
  window.__lavagemSyncMock = {{
    serverRows: rows.map((row) => ({{ ...row }})),
    fetches: [],
    pendingFetches: {{}},
    writes: [],
    channels: [],
    removedChannels: 0,
    nextFetchId: 0,
    deferNextFetch: true,
    deferredRows: rows.map((row) => ({{ ...row }})),
  }};
}})();
"""


def ensure_vite_server() -> tuple[subprocess.Popen[bytes] | None, str]:
    """Use an existing Vite server or start one on localhost:3000."""
    try:
        with urlopen(f"{BASE_URL}/lavagem-sync-test.html", timeout=1):
            return None, BASE_URL
    except (OSError, URLError):
        pass

    command = [
        "npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        str(VITE_PORT),
    ]
    server = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        try:
            with urlopen(f"{BASE_URL}/lavagem-sync-test.html", timeout=1):
                return server, BASE_URL
        except (OSError, URLError):
            time.sleep(0.2)
    server.terminate()
    raise RuntimeError(f"Vite não respondeu em {BASE_URL}")


def wait_for(page: Page, expression: str, *, timeout: float = 5000, arg=None) -> None:
    try:
        page.wait_for_function(expression, arg=arg, timeout=timeout)
    except PlaywrightTimeoutError as exc:
        raise AssertionError(f"Condição não satisfeita em {timeout} ms: {expression}") from exc


def mock_fetches(page: Page) -> list[dict[str, object]]:
    return page.evaluate("() => window.__lavagemSyncMock.fetches.slice()")


def fresh_fetch_count(page: Page) -> int:
    return sum(1 for call in mock_fetches(page) if call["fresh"])


def visible_snapshot(page: Page) -> dict[str, object]:
    return page.evaluate(
        """
        () => ({
          count: Number(document.querySelector('#schedule-count')?.textContent || 0),
          rows: [...document.querySelectorAll('#schedule-list [data-schedule-id]')].map((node) => ({
            id: node.getAttribute('data-schedule-id'),
            status: node.getAttribute('data-situacao'),
            rowIndex: node.getAttribute('data-row-index'),
          })),
        })
        """
    )


def assert_closed_without_duplicates(page: Page, context: str) -> None:
    snapshot = visible_snapshot(page)
    assert snapshot["count"] == 2, f"{context}: quantidade inesperada: {snapshot}"
    rows = snapshot["rows"]
    assert len(rows) == 2, f"{context}: lista DOM inesperada: {snapshot}"
    assert {row["id"] for row in rows} == {"lav-6608", "lav-4626"}, snapshot
    assert all(row["status"] == "ENCERRADO" for row in rows), snapshot
    assert {row["rowIndex"] for row in rows} == {"6608", "4626"}, snapshot


def assert_fresh_after_event(page: Page, label: str, dispatch_script: str) -> None:
    before = fresh_fetch_count(page)
    page.evaluate(dispatch_script)
    wait_for(
        page,
        "(before) => window.__lavagemSyncMock.fetches.filter((call) => call.fresh).length > before",
        timeout=2500,
        arg=before,
    )
    after = fresh_fetch_count(page)
    assert after > before, f"{label}: nenhum fetch fresh novo ({before} -> {after})"
    print(f"ok: {label} disparou leitura fresh ({before} -> {after})")


def run() -> None:
    if not Path(CHROMIUM).exists():
        raise RuntimeError(f"Chromium não encontrado em {CHROMIUM}")

    server: subprocess.Popen[bytes] | None = None
    with sync_playwright() as playwright:
        server, base_url = ensure_vite_server()
        browser = playwright.chromium.launch(executable_path=CHROMIUM, headless=True)
        context = browser.new_context()
        context.add_init_script(mock_init_script())
        page = context.new_page()
        page.set_default_timeout(5000)

        def route_handler(route):
            url = route.request.url
            if "/src/lib/sheetsService.ts" in url:
                route.fulfill(
                    status=200,
                    content_type="application/javascript",
                    body=SHEETS_MODULE,
                )
                return
            if "/src/lib/supabaseClient.ts" in url:
                route.fulfill(
                    status=200,
                    content_type="application/javascript",
                    body=SUPABASE_MODULE,
                )
                return
            route.continue_()

        page.route("**/src/lib/sheetsService.ts*", route_handler)
        page.route("**/src/lib/supabaseClient.ts*", route_handler)

        try:
            page.goto(f"{base_url}/lavagem-sync-test.html", wait_until="domcontentloaded")
            page.wait_for_selector("#schedule-probe")
            wait_for(
                page,
                "() => window.__lavagemSyncMock.fetches.length === 1 && window.__lavagemSyncMock.fetches[0].deferred",
            )

            calls = mock_fetches(page)
            assert calls[0]["fresh"] is True, calls
            assert calls[0]["deferred"] is True, calls
            assert calls[0]["hasSignal"] is True, calls
            initial_fetch_id = calls[0]["id"]

            # A leitura inicial fica pendente. O banco muda e o Realtime avisa
            # durante o mesmo fetch; ambos os sinais precisam ser enfileirados.
            page.evaluate(
                "(rows) => window.__lavagemSyncMock.setServerRows(rows)",
                closed_rows(),
            )
            page.evaluate(
                """
                () => {
                  window.__lavagemSyncMock.emitStatus('SUBSCRIBED');
                  window.__lavagemSyncMock.emitRealtime({
                    eventType: 'UPDATE',
                    table: 'lavagem_lubrificacao',
                  });
                }
                """
            )
            page.evaluate(
                "(id) => window.__lavagemSyncMock.resolveFetch(id)",
                initial_fetch_id,
            )

            # A fila deve iniciar a leitura fresh logo no finally do fetch
            # inicial; esperar só 250 ms evita que o debounce de 400 ms do
            # evento Realtime mascare uma implementação sem fila.
            page.wait_for_timeout(250)
            calls_after_release = mock_fetches(page)
            fresh_after_release = [call for call in calls_after_release if call["fresh"]]
            assert fresh_after_release, (
                "SUBSCRIBED/Realtime concorrentes não geraram follow-up fresh "
                f"imediato: {calls_after_release}"
            )
            wait_for(
                page,
                "() => document.querySelectorAll('#schedule-list [data-situacao=ENCERRADO]').length === 2",
                timeout=4000,
            )
            assert_closed_without_duplicates(page, "follow-up após leitura concorrente")
            print("ok: leitura inicial de 2 PCM + follow-up fresh sem fantasma/duplicata")

            assert_fresh_after_event(
                page,
                "focus",
                "() => window.dispatchEvent(new Event('focus'))",
            )
            assert_fresh_after_event(
                page,
                "visibilitychange",
                "() => document.dispatchEvent(new Event('visibilitychange'))",
            )
            assert_fresh_after_event(
                page,
                "online",
                "() => window.dispatchEvent(new Event('online'))",
            )
            assert_fresh_after_event(
                page,
                "reconexão SUBSCRIBED",
                "() => window.__lavagemSyncMock.emitStatus('SUBSCRIBED')",
            )
            assert_closed_without_duplicates(page, "eventos de recuperação")

            # Uma única espera de segurança cobre o intervalo automático de
            # 15 s sem usar APIs de clock dependentes da versão do Playwright.
            calls_before_timer = len(mock_fetches(page))
            page.wait_for_timeout(15_500)
            calls_after_timer = len(mock_fetches(page))
            assert calls_after_timer > calls_before_timer, (
                "o auto-refresh de 15 s não realizou nova leitura "
                f"({calls_before_timer} -> {calls_after_timer})"
            )
            print("ok: auto-refresh de 15 s realizou nova leitura")

            # Timeout determinístico: uma leitura deferred permanece presa
            # por mais de 20 s no relógio virtual. O hook deve abortar a
            # tentativa, destravar syncing/loading e expor o erro; em seguida
            # uma leitura manual deve recuperar sem ficar presa no lock.
            clock = getattr(page, "clock", None)
            assert clock is not None, "Playwright sem page.clock para o teste de timeout"
            clock.install()
            page.evaluate(
                "(rows) => window.__lavagemSyncMock.configureNextDeferred(rows)",
                closed_rows(),
            )
            page.click("#refresh-schedules")
            wait_for(
                page,
                "() => window.__lavagemSyncMock.fetches.some((call) => call.deferred && window.__lavagemSyncMock.pendingFetchIds().includes(call.id))",
                timeout=3000,
            )
            timeout_pending = page.evaluate("() => window.__lavagemSyncMock.pendingFetchIds()")
            assert timeout_pending, "leitura deferred do timeout não ficou pendente"
            clock.fast_forward(20_100)
            wait_for(
                page,
                "() => document.querySelector('#syncing-state')?.textContent === 'false' && document.querySelector('#loading-state')?.textContent === 'false'",
                timeout=3000,
            )
            timeout_error = page.locator("#error-state").inner_text()
            assert "20 segundos" in timeout_error, timeout_error
            # A Promise mockada ainda tem resolver, embora o race do hook já
            # tenha abortado; liberá-la evita um pending artificial no teste.
            page.evaluate(
                "(id) => window.__lavagemSyncMock.resolveFetch(id)",
                timeout_pending[-1],
            )
            page.click("#refresh-schedules")
            wait_for(
                page,
                "() => document.querySelectorAll('#schedule-list [data-situacao=ENCERRADO]').length === 2",
                timeout=3000,
            )
            wait_for(
                page,
                "() => document.querySelector('#syncing-state')?.textContent === 'false' && document.querySelector('#error-state')?.textContent === ''",
                timeout=3000,
            )
            assert_closed_without_duplicates(page, "recuperação após timeout")
            print("ok: timeout de 20 s destravou e fetch seguinte recuperou")

            # Começa uma leitura fresh antiga, desmonta o hook e só então a
            # libera. O resultado stale não pode contaminar a remontagem/cache.
            page.evaluate(
                "(rows) => window.__lavagemSyncMock.configureNextDeferred(rows)",
                stale_rows(),
            )
            page.click("#refresh-schedules")
            wait_for(
                page,
                "() => window.__lavagemSyncMock.fetches.some((call) => call.deferred && window.__lavagemSyncMock.pendingFetchIds().includes(call.id))",
                timeout=3000,
            )
            pending = page.evaluate("() => window.__lavagemSyncMock.pendingFetchIds()")
            assert pending, "refresh de remontagem não ficou pendente"
            stale_fetch_id = pending[-1]

            page.click("#toggle-hook")
            page.wait_for_selector("#hook-unmounted")
            page.click("#toggle-hook")
            page.wait_for_selector("#schedule-probe")
            page.evaluate(
                "(id) => window.__lavagemSyncMock.resolveFetch(id)",
                stale_fetch_id,
            )
            page.wait_for_timeout(250)
            assert_closed_without_duplicates(page, "resultado stale após desmontagem/remontagem")

            # Uma segunda remontagem lê o cache; isto detecta se a resposta
            # atrasada gravou ANDAMENTO depois que a instância anterior morreu.
            page.click("#toggle-hook")
            page.wait_for_selector("#hook-unmounted")
            page.click("#toggle-hook")
            page.wait_for_selector("#schedule-probe")
            assert_closed_without_duplicates(page, "cache após resposta stale pós-unmount")
            print("ok: resposta stale pós-unmount não contaminou a remontagem")

            print("OK: lavagem-sync-ui-test")
        finally:
            context.close()
            browser.close()
            if server is not None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # pragma: no cover - saída de teste CLI
        print(f"FAIL: {exc}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
