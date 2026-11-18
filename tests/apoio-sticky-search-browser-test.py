from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "tests/.tmp-apoio-sticky-search"


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        file_name = url.split("?")[0].lstrip("/") or "index.html"
        candidate = ASSETS / file_name
        return str(candidate if candidate.is_file() else ROOT / "public" / file_name)

    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}"


def search_y(page):
    box = page.locator(".apoio-sticky-search").bounding_box()
    assert box is not None, "a busca do Apoio deve estar anexada ao conteúdo"
    return box["y"]


def scroll_main(page, target):
    page.locator("main").evaluate(
        "(element, value) => { element.scrollTop = value; }", target
    )
    page.wait_for_timeout(35)


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=["--no-sandbox"],
        )
        viewports = [(390, 844), (719, 900), (1366, 900), (844, 390)]

        for width, height in viewports:
            page = browser.new_page(
                viewport={"width": width, "height": height},
                locale="pt-BR",
                timezone_id="America/Sao_Paulo",
            )
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.route(
                "**/*",
                lambda route: route.continue_()
                if route.request.url.startswith(base)
                or route.request.url.startswith("data:")
                else route.abort(),
            )
            page.goto(base, wait_until="networkidle")

            main = page.locator("main")
            search_panel = page.locator(".apoio-sticky-search")
            search = page.get_by_role(
                "textbox", name="Pesquisar frota, OS ou narrativa", exact=True
            )
            expect(search).to_be_visible()
            expect(page.locator(".apoio-filter-center")).to_be_visible()

            # A busca única é declarada no conteúdo, antes das abas, sem slot separado no shell.
            assert page.locator("#apoio-search-dock").count() == 0, (width, "dock id")
            assert page.locator(".apoio-search-dock").count() == 0, (width, "dock class")
            assert page.locator("input#apoio-direct-search").count() == 1, (
                width,
                "duplicate search input",
            )
            assert main.locator("#apoio-direct-search").count() == 1, (
                width,
                "search input must be inside main",
            )
            topology = page.evaluate(
                """() => {
                    const panel = document.querySelector('.apoio-sticky-search');
                    const tabs = document.querySelector('.mt-status-tabs');
                    const filters = document.querySelector('details.apoio-filter-center');
                    const main = document.querySelector('main');
                    return {
                        insideMain: !!main?.contains(panel),
                        afterFilters: !!filters && !!panel && !!(filters.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
                        beforeTabs: !!panel && !!tabs && !!(panel.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING),
                        position: panel ? getComputedStyle(panel).position : null,
                    };
                }"""
            )
            assert topology["insideMain"] is True, (width, topology)
            assert topology["afterFilters"] is True, (width, topology)
            assert topology["beforeTabs"] is True, (width, topology)
            assert topology["position"] == "static", (width, topology)

            # O acesso a grupos fica visível mesmo com o acordeão de relatórios recolhido.
            section_switcher = page.get_by_role("group", name="Seções do Controle Apoio")
            expect(section_switcher).to_be_visible()
            reports_details = page.locator("details.apoio-extra-tools")
            assert reports_details.count() == 1, width
            assert reports_details.evaluate("element => !element.open"), width
            section_switcher.get_by_role(
                "button", name="Grupos Apoio e nossas frotas", exact=True
            ).click()
            expect(page.get_by_role("heading", name="Criar ou editar grupo Apoio")).to_be_visible()
            expect(page.get_by_role("button", name="Criar grupo", exact=True)).to_be_visible()
            assert reports_details.evaluate("element => !element.open"), (
                width,
                "opening group form must not require reports disclosure",
            )
            section_switcher.get_by_role(
                "button", name="Ordens e relatórios", exact=True
            ).click()
            expect(search).to_be_visible()

            search_icon = page.locator(".apoio-direct-search-control svg")
            assert search_icon.count() == 1, (width, "search icon")
            icon_box = search_icon.bounding_box()
            input_box = search.bounding_box()
            assert icon_box is not None and input_box is not None, (width, "search geometry")
            assert input_box["x"] >= icon_box["x"] + icon_box["width"] + 4, (
                width,
                "search icon overlaps input text area",
                icon_box,
                input_box,
            )

            # Os filtros expandidos aumentam o fluxo acima da pesquisa; recolhê-los a devolve.
            filter_details = page.locator("details.apoio-filter-center")
            assert filter_details.count() == 1, width
            assert filter_details.evaluate("element => !element.open")
            scroll_main(page, 0)
            baseline_y = search_y(page)
            filter_details.evaluate("element => { element.open = true; }")
            scroll_main(page, 0)
            expanded_y = search_y(page)
            assert expanded_y > baseline_y + 10, (
                width,
                "search should follow expanded filters in page flow",
                baseline_y,
                expanded_y,
            )
            filter_details.evaluate("element => { element.open = false; }")
            scroll_main(page, 0)
            assert abs(search_y(page) - baseline_y) <= 2, (width, "search did not return")

            # Relatórios e ferramentas permanecem anexados ao DOM nas larguras testadas.
            report_toolbar = page.locator(".mt-toolbar-actions")
            for report_name in ("Relatório PDF", "Excel"):
                report_button = report_toolbar.get_by_role(
                    "button", name=report_name, exact=True
                )
                assert report_button.count() == 1, (width, report_name)
                assert report_button.evaluate("element => element.isConnected"), (
                    width,
                    report_name,
                )
            assert page.locator(".apoio-extra-tools").count() == 1, width

            # Estende o contêiner para verificar que a pesquisa rola junto do conteúdo.
            main.evaluate(
                """element => {
                    const existing = document.getElementById('apoio-sticky-search-test-filler');
                    if (existing) existing.remove();
                    const filler = document.createElement('div');
                    filler.id = 'apoio-sticky-search-test-filler';
                    filler.setAttribute('aria-hidden', 'true');
                    filler.style.cssText = 'height:3000px;min-height:3000px;flex:none;';
                    element.appendChild(filler);
                }"""
            )
            scroll_metrics = main.evaluate(
                "element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight })"
            )
            assert scroll_metrics["scrollHeight"] >= 3000, (width, scroll_metrics)
            max_scroll = max(
                0, scroll_metrics["scrollHeight"] - scroll_metrics["clientHeight"]
            )
            half_scroll = max_scroll // 2
            baseline_y = search_y(page)
            positions = [
                0,
                min(200, max_scroll),
                half_scroll,
                max_scroll,
                half_scroll,
                min(200, max_scroll),
                0,
            ]
            for target in positions:
                scroll_main(page, target)
                actual_scroll = main.evaluate("element => element.scrollTop")
                assert abs(actual_scroll - target) <= 2, (
                    width,
                    "main did not reach requested scroll",
                    target,
                    actual_scroll,
                )
                current_y = search_y(page)
                assert abs(current_y - (baseline_y - target)) <= 3, (
                    width,
                    target,
                    "search should move with main content",
                    baseline_y,
                    current_y,
                )

            # A pesquisa filtra os cartões e preserva foco/cursor durante a rolagem.
            search.fill("159330468")
            expect(search).to_have_value("159330468")
            icon_box = search_icon.bounding_box()
            input_box = search.bounding_box()
            assert icon_box is not None and input_box is not None
            assert input_box["x"] >= icon_box["x"] + icon_box["width"] + 4, (
                width,
                "search icon overlaps the typed fleet number",
                icon_box,
                input_box,
            )
            expect(page.locator(".mt-order")).to_have_count(1)
            search.evaluate(
                "element => { element.focus(); element.setSelectionRange(4, 4); }"
            )
            caret_before = search.evaluate(
                "element => ({ active: document.activeElement === element, start: element.selectionStart, end: element.selectionEnd })"
            )
            assert caret_before == {"active": True, "start": 4, "end": 4}, (
                width,
                caret_before,
            )
            scroll_main(page, half_scroll)
            caret_after = search.evaluate(
                "element => ({ active: document.activeElement === element, start: element.selectionStart, end: element.selectionEnd })"
            )
            assert caret_after == caret_before, (width, caret_before, caret_after)

            page.get_by_role("button", name="Limpar busca", exact=True).click()
            expect(page.locator(".mt-order")).to_have_count(4)
            assert page.locator("input#apoio-direct-search").count() == 1, width

            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), (
                width,
                "horizontal document overflow",
            )
            assert page.evaluate("window.__apoioMock.writes.length") == 0, (width, "writes")
            assert not errors, (width, errors)
            page.close()

        # Uma rota sem Apoio não deve renderizar a pesquisa.
        reference_page = browser.new_page(
            viewport={"width": 1366, "height": 900},
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
        )
        reference_errors = []
        reference_page.on("pageerror", lambda error: reference_errors.append(str(error)))
        reference_page.route(
            "**/*",
            lambda route: route.continue_()
            if route.request.url.startswith(base)
            or route.request.url.startswith("data:")
            else route.abort(),
        )
        reference_page.goto(f"{base}/?reference=1", wait_until="networkidle")
        assert reference_page.locator("#apoio-search-dock").count() == 0
        assert reference_page.locator(".apoio-search-dock").count() == 0
        assert reference_page.locator("#apoio-direct-search").count() == 0
        assert not reference_errors, reference_errors
        reference_page.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print(
    "OK: busca Apoio dentro do conteúdo em 390/719/1366/844, acompanha filtros e rolagem, "
    "preserva foco/cursor, filtra e limpa cartões sem overflow, duplicata, erros ou gravações; "
    "rota de referência sem busca."
)
