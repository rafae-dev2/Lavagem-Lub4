# Aplicativo v10.11 — imagens sem fundo, filtros e tabela móvel

## O que foi ajustado

As 13 ilustrações foram auditadas. Caminhão Caçamba e Reboque Prancha ainda apresentavam um fundo cinza retangular: esses dois recortes foram refeitos com alpha verdadeiro. As outras 11 imagens já estavam transparentes e foram conservadas. Todas estão em PNG no diretório `equipment-types`, mantendo proporção e transparência. Bordas, molduras e painéis do aplicativo podem continuar com fundo próprio; isso não é um fundo inserido na imagem.

Controle de Equipamentos — Apoio deixou de distribuir busca, abas e filtros em colunas altas e estreitas. A busca ocupa a área disponível, os blocos dos filtros seguem um fluxo vertical e os seletores usam três, duas ou uma coluna conforme a largura. As abas têm altura natural e os cartões seguem a referência Reformas sem serem esticados pelo painel dos filtros.

Em Lavagem / Lubrificação, Tabela é o modo padrão também no celular. Há seleção entre Tabela, Cartões e Quadro de Turnos; a escolha fica armazenada no dispositivo. A tabela conserva cabeçalho, colunas, edição, detalhes e ações, com rolagem horizontal por toque. Cartões usa uma apresentação compacta específica, sem transformar automaticamente a escolha Tabela em cartões.

## Cadastro de imagens por grupo

Abra **Configurações > Ilustrações por grupo de equipamento**. Escolha o grupo, selecione PNG/JPEG/WebP, confira a prévia e clique em Salvar ilustração. O original aceita até8 MiB e16 milhões de pixels; é decodificado e reencodificado no próprio navegador para até640 px no maior lado e no máximo180.000 bytes. A saída é WebP com alpha preservado, ou PNG caso o navegador não ofereça WebP. O arquivo original nunca é enviado ao servidor; a imagem compacta fica no Supabase Storage, enquanto o banco contém somente grupo, caminho, tipo, tamanho e dimensões.

As novas imagens são prioritárias para as frotas cadastradas no grupo e aparecem nas miniaturas dos módulos e nos relatórios PDF/PNG/Excel já ilustrados. Números de frota e OS não são removidos nem substituídos por imagens. Excel conserva suas abas de dados e inclui a aba Equipamentos ilustrados com a mídia incorporada, não somente um link.

**A compressão preserva transparência existente; ela não remove automaticamente fundos de novos uploads.** Para novas imagens sem fundo, escolha PNG ou WebP já recortado. JPEG tem fundo opaco. As 13 imagens entregues nesta versão já estão recortadas. Imagens animadas são achatadas no primeiro quadro. O botão Restaurar ilustração padrão remove a personalização do grupo e volta ao catálogo original, quando houver uma ilustração padrão disponível.

O arquivo novo recebe uma URL própria a cada substituição. O anterior só é removido depois da confirmação dos metadados. Falha de gravação não apaga a imagem anterior. O aplicativo consulta os metadados leves do catálogo a cada5 minutos enquanto visível, sem acelerar a sincronização das ordens; salvar/restaurar dispara atualização imediata no próprio dispositivo. Outros dispositivos recebem a alteração na próxima consulta ou ao voltar para a janela.

## Segurança e estado do Supabase

O projeto `qcpnnyqzosnomvvytmfi` já recebeu o bucket `equipment-group-images`, limite de180.000 bytes e MIME PNG/WebP, a tabela de metadados `equipment_group_images` e as políticas de segurança da migração `supabase/EQUIPMENT_GROUP_IMAGES.sql`. A leitura das imagens é pública para que os módulos e relatórios funcionem sem login. Upload e edição exigem autenticação e e-mail presente na lista privada `equipment_image_editors`. Nenhuma chave de serviço é enviada ao navegador e não há upload anônimo.

**Etapa ainda pendente nesta entrega:** informar o e-mail do administrador autorizado e concluir o login no painel Supabase para acrescentar `https://controlelogisticalub.netlify.app/#configuracoes` às URLs de retorno do login. O painel continuou exigindo login durante a verificação. Não foi escolhido um e-mail arbitrário nem liberada escrita pública. Até a autorização ser concluída, o cadastro mostra somente leitura e as imagens padrão, filtros, tabela e relatórios do aplicativo continuam funcionando.

Após confirmar o e-mail, o administrador pode ser habilitado por uma operação controlada de cadastro na tabela privada, sem alterar permissões das ordens. O botão Enviar link de acesso somente envia e-mail quando acionado pelo usuário. O link autentica o editor do aplicativo; não é o login do painel administrativo Supabase.

## Publicar no Netlify

O ZIP compilado é pronto para publicação: extraia e envie **todo o conteúdo extraído**, com `index.html`, `assets`, `equipment-types`, `_redirects`, logotipo e worker PDF no nível raiz. Não publique apenas index.html nem mantenha um compilado anterior com assets novos. Depois da publicação, recarregue o site sem cache no navegador.

O site Netlify não foi publicado automaticamente. A configuração do Storage já foi aplicada; os ajustes visuais e o cadastro novo só entram no site após publicar este compilado.

O ZIP de fontes contém a pasta `aplicativo`. Para desenvolver, use Node.js 20.19+ ou 22.13+, execute `npm ci`, `npm run check` e `npm run build`. Os comandos de teste da versão estão no package.json; os testes de navegador usam Playwright/Chromium e somente dados simulados, sem gravações no banco real.
