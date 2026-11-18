# Critérios dos acompanhamentos de manutenção

## Origem e pré-requisitos

As três telas usam `carregar_acompanhamento_manutencao`, uma leitura específica com RLS sobre a mesma fotografia da Gestão de Ordens e do Controle Apoio. `sync-ordens` atualiza essa fotografia no servidor. Duas migrações incrementais foram aplicadas no projeto Supabase autorizado; nenhuma tabela ou ordem foi apagada. O navegador não lê nem modifica o iframe do PIMS.

A melhor precisão de classificação depende dos campos **classe**, **motivo**, **ponto** e **cd_ponto** preservados pelo contrato da integração PIMS (`supabase/functions/sync-ordens/validation.ts`) e pela extensão PCM existente. Esses campos são opcionais em instalações antigas. Classe é regime de manutenção; motivo/ponto/setor/narrativa identificam o serviço. Assim, uma classe genérica `PREVENTIVA` não exclui uma lubrificação identificada no motivo ou ponto, enquanto uma corretiva desconhecida não vira preventiva por aproximação. Quando toda a fotografia não informa classe/motivo, a interface mostra um aviso e informa que usa somente ponto/narrativa. **Não execute novamente os SQLs antigos para instalar esta atualização visual.** Verifique separadamente a configuração da integração se os campos não estiverem disponíveis.

## Quais equipamentos entram

| Módulo | Critério de equipamento |
| --- | --- |
| Preventivas e Lubrificação de Carretas Canavieiras | Número de frota no mapa padrão `carretas_canavieiras`, ou identificação explícita de carreta canavieira/reboque de cana no grupo/modelo da fonte ou no grupo/nome do equipamento cadastrado no Apoio. |
| Reformas dos Equipamentos Apoio | Número de frota cadastrado em `apoio_frotas`. A associação aos grupos segue o cadastro do Controle Apoio. |

“Carreta” isoladamente não identifica uma carreta canavieira. Identidades que também dizem caminhão/cavalo são rejeitadas no reconhecimento textual conservador. Uma frota nova pode ser reconhecida por grupo/nome compartilhado com descrição assertiva, evitando depender exclusivamente da lista padrão. A atualização não lê a planilha antiga de Carretas nem apaga seus registros.

## Quais serviços entram

Os critérios são normalizados sem diferenciar acentos ou maiúsculas. Campos estruturados conhecidos têm prioridade; ponto/narrativa são fallback quando não há classificação estruturada conhecida.

| Módulo | Critério de serviço |
| --- | --- |
| Preventivas | Termo explícito de preventiva (`prevent*`) ou plano mecânico. Não basta ser uma ordem de carreta ou não pertencer a outro serviço. Reforma e lubrificação ficam fora desta seleção mecânica. |
| Lubrificação | Termos explícitos de lubrificação, engraxamento, graxa ou graxagem. Lavagem, limpeza ou troca de óleo **isoladas** não entram. Uma ordem combinada que explicita lubrificação pode entrar. |
| Reformas | Termos explícitos de reforma, reformando, recondicionamento ou restauração. Manutenção, reparo e corretiva isolados não são classificados como reforma. |

O motivo da inclusão é mostrado nos detalhes e relatórios. A identificação por texto é uma regra de acompanhamento, não uma validação humana do serviço. Descrições insuficientes ou conflitantes podem deixar uma ordem fora do módulo; a Gestão de Ordens permanece disponível para consultar a origem completa.

## Status e encerramento

Programado contempla os status explícitos programado/programada/agendado/agendada. Andamento contempla andamento/em andamento/em execução. Pendente, aguardando peça, aberta, atrasado e valores desconhecidos permanecem em Outros, com o status original preservado no card/tabela/detalhe. Os quatro status operacionais principais são Programado, Andamento, Encerrado e Outros; `ausente` permanece somente como fallback de compatibilidade para registro inativo sem prova suficiente.

Encerrado pode ter duas origens separadas: **fonte**, quando o status bruto é encerrado/concluído/realizado/fechado; ou **ausência**, quando `ativo=false` e a integração validada registrou `primeira_vista`, `ultima_vista` e `ausente_desde` como datas válidas, com primeira presença ≤ última presença ≤ detecção de saída. A segunda origem significa **encerramento operacional por saída da fonte**: a data detectada não confirma a execução real e não é data humana de realização. O status bruto e os campos da fonte nunca são regravados.

Ordem inativa sem esse conjunto de prova permanece em Outros na interface, com aviso de inconsistência e sem falso encerramento. Falha, atraso ou snapshot inválido não produzem novos encerramentos. Se a ordem reaparecer ativa e programada, o acompanhamento reabre a situação e remove a origem/data derivadas do encerramento. Filtros e contadores oficiais usam somente o status derivado; a busca por status bruto fica disponível apenas para valores fora desse vocabulário.

## Datas, filtros e relatórios

Datas sem fuso representam horário operacional Brasília (-03); horários com offset explícito são convertidos para America/Sao_Paulo. Datas impossíveis são rejeitadas para filtros e cálculos e apresentadas como inconsistentes. A previsão sem horário vence somente depois do fim do seu dia em Brasília. O alerta Previsão vencida exige previsão válida e ordem sem encerramento/ausência; o cálculo nunca grava uma mudança de status.

O período filtra a **entrada**, inclusive nas duas extremidades. Grupo, local, prestador, status e busca intersectam a seleção. Os indicadores exibem o recorte dos demais filtros antes do filtro de status para permitir alternar situações; o título dos resultados informa a quantidade realmente selecionada.

A paginação limita somente a tela. PDF e Excel recebem a seleção completa e a mesma ordem dos resultados, com fonte/horários e aviso de atualização. O cabeçalho dos relatórios mantém a identidade premium verde/dourada da marca Apoio. O PDF apresenta narrativa, motivo, classe, critério, origem do encerramento e data de detecção. O Excel separa `Origem encerramento` e `Data detecção encerramento`, preserva também os campos brutos de origem, presença e detecção, e mantém a advertência “Encerramento operacional por saída da fonte; data detectada não confirma execução real.” Campos textuais que poderiam iniciar fórmulas são exportados como texto literal no Excel.
