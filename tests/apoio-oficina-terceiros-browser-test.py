import base64
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'tests/.tmp-oficina-terceiros'
OUT = Path('/home/ubuntu/output/evidencias')
OUT.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        name = url.split('?')[0].lstrip('/') or 'index.html'
        candidate = ASSETS / name
        if candidate.is_file():
            return str(candidate)
        return str(ROOT / 'public' / name)

    def log_message(self, *args):
        pass


def row(index, frota, modelo, prestador, origem='Oficina Externa', status='Em andamento', ativo=True, apoio='Veículos Leves'):
    return {
        'chave': f'chave-{index}', 'os': f'OS-{index}', 'frota': frota, 'modelo': modelo,
        'grupo_fonte': 'Implementos', 'setor': '', 'ponto': '', 'origem': origem,
        'prestador': prestador, 'status': status, 'entrada': '2026-11-10', 'previsao': '',
        'narrativa': 'Revisão geral', 'ativo': ativo, 'primeira_vista': '2026-11-10T08:00:00-03:00',
        'ultima_vista': '2026-11-14T08:00:00-03:00', 'ausente_desde': None,
        'apoio': apoio, 'equipamento': modelo,
    }


ROWS = [
    row(1, '8825', 'Ren Oroch 1.6 SCe', 'SILAS EDUARDO MOURA DA SILVA', apoio='Caminhão Pipa'),
    row(2, '8826', 'Ren Oroch 1.6 SCe', 'SILAS EDUARDO MOURA DA SILVA', apoio='Caminhão Pipa'),
    row(3, '30941', 'Usi Reboque Muda 2 Eixos', 'BONANI, OLIVEIRA & FRESCA LTDA - ME', apoio='Carretas Canavieiras'),
    row(4, '29001', 'Fac SR Vinhaça 2E', 'NOROAGRO COMERCIO DE PECAS E SERVICOS EI'),
    row(5, '4605', 'MB 3344 6x4 Cavalo Mec', 'CARLOS HENRIQUE DA COSTA FRASSON-ME'),
    row(6, '4567', 'MB L 2638 6x4 Caçamba', 'SERGIO MAIA ADAMANTINA - ME'),
    row(7, '4629', 'MB Axor 3344 6x4 Bombeiro', 'FRANCISCO DAMIÃO MOREIRA DOS SANTOS ME'),
    row(8, '4574', 'MB Axor 3344 6x4 Bombeiro', 'AUTO ELÉTRICA DO MAICON'),
    row(9, '4581', 'MB 2831 6x4 muck', 'FRATINE REPARACAO DE IMPLEMENTOS RODOVIA'),
    row(10, '4508', 'MB 2219 6x4 muck', 'SERGIO MAIA ADAMANTINA - ME'),
    # Fora da oficina externa: nunca aparece no relatório.
    row(11, '4571', 'MB 2638 Caçamba', 'Oficina Interna', origem='Oficina Interna'),
    row(12, '4566', 'Trator Agrale', 'Campo', origem='Campo'),
    # Encerrada e repetida: também ficam fora.
    row(13, '4619', 'MB 3344 Cavalo', 'OFICINA ENCERRADA', status='Encerrada'),
    row(14, '8825', 'Ren Oroch 1.6 SCe', 'OFICINA REPETIDA'),
]

checks = []


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    checks.append(message)


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1200, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) or route.request.url.startswith('data:') or route.request.url.startswith('blob:') else route.abort())
        page.goto(base + '/', wait_until='networkidle')

        result = page.evaluate('rows => window.runOficinaTerceiros(rows)', ROWS)

        check(not errors, f'sem erros de página: {errors}')
        check(len(result['entries']) == 10, 'somente os 10 equipamentos em oficina externa entram no relatório')
        check([entry['frota'] for entry in result['entries']][:3] == ['8825', '8826', '30941'], 'ordem da seleção é preservada')
        check(all(entry['prestador'] != 'OFICINA REPETIDA' for entry in result['entries']), 'frota repetida não duplica a linha')
        check(all(entry['frota'] != '4619' for entry in result['entries']), 'ordem encerrada não entra como parada na oficina')

        check(result['rendered']['width'] == 921 and result['rendered']['height'] == 1600, 'formato declarado é 921 × 1600')
        check(result['rendered']['count'] == 1, 'exportação gera um único arquivo, sem ZIP')
        image = result['rendered']['image']
        check(image['width'] == 921 and image['height'] == 1600, 'PNG gerado tem exatamente 921 × 1600 pixels')
        check(image['type'] == 'image/png' and image['bytes'] > 30000, 'PNG não perde qualidade nem fica vazio')

        # Logotipo sem caixa branca: os cantos da antiga moldura mostram o
        # verde do cabeçalho, e não branco opaco.
        for index, pixel in enumerate(result['rendered']['pixels'][:3]):
            red, green, blue, alpha = pixel
            check(alpha == 255, f'cabeçalho opaco no ponto {index}')
            check(not (red > 235 and green > 235 and blue > 235), f'ponto {index} do logotipo não é branco ({pixel})')
            check(green > red + 15 and green > blue, f'ponto {index} do logotipo mostra o verde do cabeçalho ({pixel})')

        page_doc = result['pages'][0]
        check(page_doc['width'] == 921 and page_doc['height'] == 1600, 'imagem composta mede 921 × 1600')
        check(page_doc['overflow'] == '0', 'nenhum conteúdo estoura a imagem')
        check(page_doc['rows'] == 10, 'as 10 linhas ficam na mesma imagem, sem paginação')
        text = page_doc['text']
        check('Equipamentos em Oficina de Terceiros' in text, 'título do relatório presente')
        check('BRANCO PERES AGRO' in text and 'Controle de Equipamentos — Apoio' in text, 'cabeçalho com marca do PDF')
        check('Equipamento' in text and 'Modelo' in text and 'Prestador' in text, 'três colunas do relatório')
        check('8825' in text and 'Ren Oroch 1.6 SCe' in text, 'frota e modelo do exemplo presentes')
        check('SILAS EDUARDO MOURA DA SILVA' in text, 'oficina de terceiro presente')
        check('10 equipamentos' in text, 'rodapé mostra a quantidade de equipamentos')
        check('Página' not in text, 'rodapé não usa paginação')
        check('Oficina Interna' not in text and 'Campo' not in text, 'oficinas internas e campo ficam fora')
        check('OFICINA REPETIDA' not in text and 'OFICINA ENCERRADA' not in text, 'repetida e encerrada ficam fora')

        (OUT / 'equipamentos-oficina-terceiros-v10.28.png').write_bytes(
            base64.b64decode(image['dataUrl'].split(',', 1)[1])
        )

        # Lista extensa: continua sendo UMA imagem; a altura cresce junto com
        # o conteúdo, mantendo a largura do celular.
        many = [row(100 + index, str(8000 + index), f'MB 3344 6x4 Cavalo Mec unidade {index}', f'OFICINA DE TERCEROS {index:02d} LTDA') for index in range(40)]
        long_result = page.evaluate('rows => window.runOficinaTerceiros(rows)', many)
        long_height = long_result['rendered']['height']
        check(long_result['rendered']['width'] == 921, 'lista extensa mantém a largura 921')
        check(long_height > 1600, f'lista extensa cresce em altura ({long_height}px)')
        check(long_height <= 12000, 'altura da lista extensa respeita o limite seguro')
        check(long_result['rendered']['image']['height'] == long_height, 'PNG da lista extensa tem a altura informada')
        check(long_result['rendered']['image']['width'] == 921, 'PNG da lista extensa tem 921 px de largura')
        check(long_result['pages'][0]['rows'] == 40, 'lista extensa cabe em uma única imagem')
        check(long_result['pages'][0]['overflow'] == '0', 'lista extensa não estoura a imagem')
        check('OFICINA DE TERCEROS 39 LTDA' in long_result['pages'][0]['text'], 'última linha da lista extensa presente')
        check('40 equipamentos' in long_result['pages'][0]['text'], 'rodapé da lista extensa mostra 40 equipamentos')

        # Seleção parcial: só os equipamentos marcados entram na imagem.
        subset = page.evaluate('rows => window.runOficinaTerceiros(rows)', ROWS[:2])
        check(len(subset['entries']) == 2, 'seleção parcial exporta somente os marcados')
        check(subset['pages'][0]['rows'] == 2, 'seleção parcial tem duas linhas')
        check('2 equipamentos' in subset['pages'][0]['text'], 'rodapé da seleção parcial mostra 2 equipamentos')
        check('30941' not in subset['pages'][0]['text'], 'equipamento desmarcado fica fora da imagem')

        browser.close()
    print(f'OK: relatório Equipamentos em Oficina de Terceiros — {len(checks)} verificações (imagem única 921 × 1600, cabeçalho, três colunas, seleção parcial).')
finally:
    server.shutdown()
