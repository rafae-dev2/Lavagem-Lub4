# Relatórios premium — verde com blur e imagens Ultra

O relatório PDF passou a usar a paleta verde da Gestão de Ordens, com gradientes suaves, efeito blur no cabeçalho e cards, logotipo da empresa e agrupamento por Apoio e oficina. A informação Fonte foi retirada das exportações. Local da oficina, prestador, status, datas operacionais, equipamentos e narrativas continuam presentes.

## Como exportar

Abra Controle de Equipamentos — Apoio e aplique os filtros desejados. Relatório premium gera o PDF e Excel exporta a planilha. O novo botão Imagem premium abre os controles de formato e qualidade; selecione as opções e clique em Baixar imagens PNG.

Todas as exportações usam o conjunto completo de ordens filtradas, não apenas a página visível na interface. Relatórios extensos são distribuídos em páginas numeradas; textos longos continuam em outra página com a identificação da frota e da OS. Não há corte automático da narrativa.

## Formatos de imagem

Celular e Instagram Stories são verticais, em proporção 9:16. Na qualidade Ultra, cada página possui 2160 × 3840 pixels; na qualidade Alta, 1080 × 1920 pixels.

Desktop é horizontal, em proporção 16:9. Na qualidade Ultra, cada página possui 3840 × 2160 pixels, resolução 4K; na qualidade Alta, 2560 × 1440 pixels.

Instagram Feed usa proporção 4:5. Na qualidade Ultra, cada página possui 2160 × 2700 pixels; na qualidade Alta, 1080 × 1350 pixels.

As imagens são PNG sem perdas. Um relatório de uma página baixa diretamente como PNG. Um relatório com várias páginas baixa como ZIP contendo arquivos PNG numerados. Extraia o ZIP e compartilhe as imagens na sequência. A interface mostra o andamento da geração. A opção Ultra usa mais memória e pode levar mais tempo no celular; use Alta para arquivos mais leves.

O Instagram pode redimensionar e comprimir as imagens após a publicação; a resolução informada corresponde ao arquivo exportado pelo aplicativo. A exportação não publica automaticamente em redes sociais.

## Publicação

Esta alteração é do aplicativo, não do banco de dados. A sincronização Supabase existente permanece ativa e não exige reinstalar SQL, função ou cron.

Para publicar por upload manual no Netlify, use o ZIP pronto para Netlify: seu conteúdo corresponde à pasta dist compilada, com index.html na raiz. Para desenvolvimento ou publicação por build, use o código-fonte completo e o comando npm run build.

O endereço configurado no servidor permanece https://controlelogisticalub.netlify.app. A atualização não foi publicada nesse site por esta entrega; os novos botões aparecem depois que você republicar o aplicativo.

## Verificações

A composição das imagens foi testada com doze ordens reais, nos quatro formatos, preservando todas as OS e as narrativas completas. A continuação de uma narrativa longa foi testada em páginas de feed. Downloads reais confirmaram as dimensões Ultra de celular, desktop e Instagram Feed. Os dados usados nos testes não foram cadastrados como frota própria nem gravados no banco operacional.
