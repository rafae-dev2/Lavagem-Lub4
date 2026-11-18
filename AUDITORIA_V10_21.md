# Auditoria v10.21 — Ícone da busca sem sobreposição

## Causa e correção

A folha legada `apoio-compact-table.css` posicionava o SVG da lupa com `position:absolute`, `left` e `top`. Como o CSS novo alterava flex/alinhamento mas não anulava esses valores antigos, o texto digitado começava sob a lupa. A correção declara explicitamente `position:static`, remove inset e transform do SVG e reserva ao ícone um espaço fixo de 16 px. O input usa o espaço flex restante (`flex: 1 1 auto`, `min-width: 0`).

Mantidas as alterações v10.20: a busca segue abaixo de “Filtros de acompanhamento”, antes das abas, dentro do `main` rolável. O identificador visual foi atualizado para v10.21.

## Validação

O teste estrutural verifica as regras que anulam o posicionamento absoluto legado. O teste de navegador, em 390, 719, 1366 e 844 px de largura, mede a caixa do ícone e do input e exige uma separação mínima entre eles, também depois de digitar a pesquisa de frota. Os mesmos testes verificam filtros → busca → abas, rolagem, função de busca/limpeza e ausência de erros ou overflow horizontal.

Nenhuma chamada ou dado do Supabase foi alterado. A publicação no Netlify deve usar o ZIP compilado v10.21 com `index.html` na raiz.
