const assert = require('node:assert/strict');
const fs = require('node:fs');

const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const page = fs.readFileSync('src/pages/ControleApoio.tsx', 'utf8');
const searchStyles = fs.readFileSync('src/styles/apoio-sticky-search.css', 'utf8');

assert.doesNotMatch(layout, /apoio-search-dock/);
assert.doesNotMatch(page, /ApoioSearchDock|createPortal/);

const filtersStart = page.indexOf('<details className="mt-filters apoio-filter-center">');
const filtersEnd = page.indexOf('</details>', filtersStart);
const searchStart = page.indexOf('<section className="apoio-sticky-search"', filtersEnd);
const statusTabsStart = page.indexOf('<div className="mt-status-tabs"', searchStart);
assert.ok(filtersStart >= 0, 'o painel Filtros de acompanhamento existe');
assert.ok(filtersEnd > filtersStart, 'o painel de filtros fecha corretamente');
assert.ok(searchStart > filtersEnd, 'a busca fica abaixo de Filtros de acompanhamento');
assert.ok(statusTabsStart > searchStart, 'a busca fica antes das abas de situação');
assert.match(page.slice(searchStart, statusTabsStart), /Pesquisar frota, OS ou narrativa/);
assert.match(page.slice(searchStart, statusTabsStart), /Limpar busca/);

assert.match(searchStyles, /\.apoio-module\s+\.apoio-sticky-search\s*\{/);
assert.match(searchStyles, /position:\s*static\s*!important/);
assert.match(searchStyles, /order:\s*0\s*!important/);
assert.match(searchStyles, /\.apoio-direct-search-control\s+svg\s*\{[\s\S]*?position:\s*static\s*!important/);
assert.match(searchStyles, /\.apoio-direct-search-control\s+input\s*\{[\s\S]*?flex:\s*1\s+1\s+auto/);
assert.doesNotMatch(searchStyles, /position\s*:\s*(?:sticky|fixed)\b/);

const sectionSwitcher = page.indexOf('aria-label="Seções do Controle Apoio"');
const reportsDisclosure = page.indexOf('<details className="mt-filters apoio-extra-tools">');
assert.ok(sectionSwitcher >= 0, 'o acesso a Grupos Apoio fica visível');
assert.ok(reportsDisclosure > sectionSwitcher, 'a navegação de grupos fica antes do acordeão de relatórios');
assert.match(page.slice(sectionSwitcher, reportsDisclosure), /Grupos Apoio e nossas frotas/);
assert.match(page.slice(reportsDisclosure), /Relatórios e atualização/);
assert.doesNotMatch(page.slice(reportsDisclosure), /aria-label="Seções do Controle Apoio"/);

console.log('OK: busca corrigida e acesso a Grupos Apoio visível fora do acordeão de relatórios.');
