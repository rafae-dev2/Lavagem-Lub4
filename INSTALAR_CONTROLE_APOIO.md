# Controle Apoio — instalação já concluída

A integração já foi instalada no projeto Supabase qcpnnyqzosnomvvytmfi em 03/11/2026. Não é necessário executar novamente os arquivos SQL para usar o aplicativo.

Leia CONFIGURACAO_SUPABASE.md para consultar as verificações de funcionamento e os próximos passos. O aplicativo autorizado é https://controlelogisticalub.netlify.app.

## Arquivos para manutenção ou restauração

supabase/APOIO_SETUP.sql contém as tabelas, as políticas públicas de classificação e as funções de reconciliação. supabase/APOIO_RUNTIME_CONFIG.sql contém a leitura privada da configuração do Vault. supabase/APOIO_CRON.sql contém o agendamento nativo de um minuto. A função do servidor está em supabase/functions/sync-ordens/index.ts e validation.ts.

A configuração desta versão é lida do Vault, não exige copiar o segredo privado para o código nem configurá-lo no frontend. O Vault possui APOIO_PROJECT_URL, APOIO_SYNC_SECRET e APOIO_ALLOWED_ORIGINS. Somente service_role pode executar obter_apoio_runtime_config, que fornece a configuração ao servidor. Não imprima nem compartilhe o valor do segredo.

Uma restauração em outro projeto exige instalar ambos os arquivos de estrutura SQL, criar esses registros no Vault, publicar sync-ordens com verify_jwt=false e ativar o cron. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente pelo ambiente hospedado do Supabase.

Para uma nova hospedagem do aplicativo, atualize APOIO_ALLOWED_ORIGINS no Vault com a origem HTTPS exata, sem caminhos. A função recarrega essa configuração periodicamente. O domínio atual já foi autorizado.

O módulo Apoio é deliberadamente público, sem login: grupos e frotas podem ser alterados por visitantes. As ordens importadas continuam somente leitura. Ordens sem equipamento não são consideradas frotas próprias, e ausência da fonte não comprova finalização.
