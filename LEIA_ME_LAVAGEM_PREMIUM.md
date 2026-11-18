# Lavagem e Lubrificação — verde e dourado premium

O módulo recebe a identidade do Controle de Equipamentos — Apoio: fundo marfim com faixas curvas verdes/douradas, cabeçalho ondulado verde profundo, logotipo oficial, botão Sincronizar metálico, bordas douradas, superfícies brancas e botões refinados. O mesmo cabeçalho acompanha Programações, Dashboard, Importar e Exportar.

O tema local permanece claro e legível mesmo se o tema global do aplicativo estiver escuro ou Glassy. As cores dos estados (Atrasado, Programado, Pendente, Andamento, Encerrado) permanecem semânticas e distintas. Informações de execução, frota, OS, observações e ações continuam separadas na tabela. O fundo decorativo fica atrás das superfícies de leitura.

## Operação e dispositivos

No computador, a tabela aproveita o espaço disponível. Em tablet/celular, a rolagem horizontal fica dentro da tabela, não na página inteira; Ações não encobre Observações no celular. Logo, cabeçalho, abas, resumo e filtros reorganizam-se conforme a largura útil. A visualização Quadro e os botões de Programações permanecem disponíveis.

Busca, filtros, edição, importação, sincronização e exportação preservam as funções existentes. As regras da janela operacional de encerradas na exportação e da ocultação da lista de programação não foram alteradas. Nenhuma OS foi criada, editada, encerrada ou removida para testar esta revisão. Modo TV e Apoio multidispositivo continuam no aplicativo completo.

O visual novo aplica-se à interface do módulo. Os arquivos de relatório PNG/PDF/Excel mantêm os geradores e seus critérios atuais; não receberam uma alteração de dados ou formato nesta tarefa.

## Publicação

Publique todo o conteúdo do ZIP compilado no site Netlify existente como substituição completa, incluindo `index.html`, `_redirects`, pasta `assets`, `logo.png` e os dois arquivos vetoriais `apoio-reference-*.svg`. Eles são reutilizados por ambos os módulos para manter a identidade visual. Não misture assets de versões diferentes.

O ZIP de fontes contém o aplicativo completo e seus testes. O pacote de scripts Supabase é somente referência para backup ou instalação nova. **Não há novo SQL necessário para este ajuste visual.** Não reaplique automaticamente scripts antigos no projeto existente, pois podem redefinir funções. A publicação no Netlify não foi feita automaticamente.

As prévias são geradas com dados fictícios. Testes de navegação e estilo bloqueiam tráfego externo para não gravar no banco de produção.
