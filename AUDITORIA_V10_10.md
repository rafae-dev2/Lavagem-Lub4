# Auditoria v10.10 — ilustrações de equipamentos

## Assets e classificação

Os 13 arquivos fornecidos foram convertidos para PNG RGBA sem perda de proporção, transparência ou corte. Nomes locais ASCII e manifesto de origem acompanham o compilado. Catálogo único com prioridade cadastro/identidade, fonte e mapa exato de frota; narrativa e campos de serviço não são usados como identidade. Trator usa imagem comum sem mudar a separação operacional dos módulos. Tipos sem imagem, como coleta, e identidades conflitantes não recebem uma fotografia inventada.

A revisão independente encontrou que o bloqueio Coleta podia ocorrer depois do modelo da fonte e deixar aparecer Munck indevidamente. Corrigido com bloqueio na camada de cadastro antes da resolução secundária. Adicionadas regressões Coleta vs Munck/Pipa. Também corrigido o envio da linha completa à miniatura da Central, preservando o fallback por número de frota.

## Telas e documentos

Miniaturas nos componentes compartilhados dos acompanhamentos/Apoio, tabelas, consulta da Central, Lavagem/turnos, Calendário, listas do Dashboard e TV. Mantidos filtros, status, cadastro, dados e animação da barra lateral. O iframe externo Gestão de Ordens é exceção explícita: suas fontes não constam no pacote e a aplicação hospedeira não pode alterar seu DOM. As ordens dessa fonte, consultadas pelos módulos nativos, recebem imagens normalmente.

O teste de navegador bloqueia serviços externos e usa as 13 identidades sintéticas. Em 1440, 768 e 390 px, foram verificadas 13 imagens carregadas, dimensões originais válidas e ausência de overflow da página. As prévias foram inspecionadas: miniatura contida ao lado da identificação, sem cobrir frota ou OS.

Exportação de PDF real do navegador para Acompanhamento, Apoio e Central: verificados todos os 13 números de OS por `pdftotext`, imagens incorporadas por `pdfimages` e arquivo não vazio. A página do PDF ilustrado foi renderizada para conferir cabeçalho, layout e espaço de equipamento/texto. Os PDFs mantêm a mesma seleção dos relatórios e validam o carregamento dos assets conhecidos antes de baixar.

Excel real: abas de dados intactas, aba complementar Equipamentos ilustrados com 13 linhas e 13 imagens. Relações Open XML e drawings conferidos; o XLSX foi reaberto por openpyxl com 13 imagens e identidades Frota/OS alinhadas. A mídia é incorporada, não depende da internet para aparecer no arquivo.

PNG de Apoio: download ZIP válido com 13 páginas PNG ilustradas, uma por grupo da fixture. Fluxos de WhatsApp derivados reutilizam essas páginas. Lavagem usa a mesma resolução e cache em PNG/PDF. Corrigidas reserva de largura no PNG compacto, máscara de célula contra vazamento nas bordas e guarda por índice de linha para não repetir imagem em fragmentos do PDF entre páginas. O Dashboard aguarda a decodificação das miniaturas antes de capturar seu PDF.

## Regressões e limites

TypeScript, classificação de 13 identidades e conflitos, Excel ilustrado, métricas/relatórios da Central, relatórios de acompanhamentos com 76 ordens e narrativa longa, menu, tabela Apoio, compactação e seleção de equipamentos de Lavagem passaram. O cache evita nova carga para cada repetição de tipo; formatos adicionais são carregados quando solicitados. A lógica de sincronização, cadência e encerramento não foi alterada.

A validação utiliza fixtures e não prova ausência absoluta de problemas em qualquer conexão/aparelho. Algumas imagens enviadas contêm detalhes de recorte/coloridos no próprio arquivo; foram preservados, sem inventar restauração ou modelo. Não houve gravação no banco real, alteração Supabase, mudança no cron ou publicação no Netlify. A pasta equipment-types deve ser publicada junto do compilado para carregar as miniaturas.

## Compilação e renderizador de Lavagem

O renderizador PNG premium de Lavagem foi chamado no navegador com fixtures de 13 tipos e exportou arquivo PNG válido. A inspeção confirma miniatura e número lado a lado. Build Vite10.10 concluído; permanece aviso prévio de chunk minificado acima de500kB, oportunidade de otimização do bundle, não falha de compilação.
