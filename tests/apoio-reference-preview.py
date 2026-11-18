from pathlib import Path
import ast
from playwright.sync_api import sync_playwright

# Reutilizar apenas fixtures e helpers, sem reexecutar a matriz inteira de testes.
source=Path('tests/apoio-premium-ui-test.py')
tree=ast.parse(source.read_text())
needed=[]
for node in tree.body:
    if isinstance(node,(ast.Import,ast.ImportFrom,ast.FunctionDef)):
        needed.append(node)
    elif isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in {'OUT','BASE','MOCK'} for t in node.targets):
        needed.append(node)
    elif isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Attribute) and node.value.func.attr=='mkdir':
        needed.append(node)
namespace={}
exec(compile(ast.Module(body=needed,type_ignores=[]),str(source),'exec'),namespace)
out=namespace['OUT']
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for theme,width,height,name in [
        ('light',1165,1560,'previa-referencia-portrait.png'),
        ('light',390,1100,'previa-referencia-celular.png'),
    ]:
        page,errors=namespace['open_page'](browser,theme,width,height)
        page.screenshot(path=str(out/name))
        assert not errors,errors
        if width==1165:
            card=page.locator('.apoio-order').first
            card.locator('.apoio-details-button').click()
            card.screenshot(path=str(out/'previa-referencia-card-e-historico.png'))
            assert page.locator('.apoio-ribbon-layer').evaluate("e=>getComputedStyle(e).backgroundRepeat==='no-repeat'")
        page.close()
    browser.close()
print('Prévias finais salvas com fonte real, mocks e fundo contínuo sem mosaico.')
