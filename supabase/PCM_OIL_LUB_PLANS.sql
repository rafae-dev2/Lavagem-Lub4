-- Regra operacional: qualquer código numérico de plano terminado em LUB é óleo.
-- Não altera reconciliação, overrides, encerramentos, ordens manuais ou ACL.
create or replace function public.pcm_classificar_fonte(
  p_setor text,
  p_ponto text,
  p_origem text,
  p_modelo text,
  p_motivo text,
  p_classe text,
  p_narrativa text,
  p_cd_ponto text
)
returns jsonb
language plpgsql immutable
set search_path = pg_catalog, public
as $$
declare
  -- Keywords só vêm de motivo/classe/narrativa. Setor e ponto são contexto;
  -- modelo/origem nunca podem transformar preventiva genérica em serviço.
  v_indicadores text := public.pcm_fold(concat_ws(' ', p_motivo, p_classe, p_narrativa));
  v_contexto text := public.pcm_fold(concat_ws(' ', p_setor, p_ponto, p_cd_ponto));
  v_lavador boolean := public.pcm_local(p_ponto, p_cd_ponto) = 'LAVADOR';
begin
  -- Plano explícito é evidência suficiente, independentemente do ponto.
  -- Somente campos de serviço; Lubrificação no setor não é código LUB.
  -- Exemplos: 302LUB, 1812LUB, 20.004LUB e 20004 LUB.
  if v_indicadores ~ '(^|[^[:alnum:]_.])[0-9]+([.][0-9]+)*[[:space:]]*lub\M' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'plano_lub_troca_oleo',
      'motivo', null
    );
  end if;

  if not v_lavador and v_contexto !~ '\m(lubrifica|comboio)' then
    return jsonb_build_object('tipo', null, 'regra', 'fora_escopo', 'motivo', null);
  end if;

  -- A expressão exige "troca(r) ... óleo"; portanto não casa com
  -- "trocar tampa do óleo" nem com "trocarregistradora".
  if v_indicadores ~ '\m(troca|trocar)([[:space:]]+(de|do))?[[:space:]]+oleo\M' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'troca_oleo_explicita',
      'motivo', null
    );
  end if;

  if v_lavador and v_indicadores ~ '604[[:space:]]*(lub|/302)' then
    return jsonb_build_object(
      'tipo', 'Troca de Óleo',
      'regra', 'plano_604_lub_lavador',
      'motivo', null
    );
  end if;

  if v_indicadores ~ '\m(lavagem|lavar)\M'
     or (
       v_contexto ~ '\mlavador\M'
       and v_indicadores ~ '\m(limpeza|higieniza)\M'
       and v_indicadores !~ '\m(conserto|regulagem|reparo|ajuste)\M'
     ) then
    return jsonb_build_object(
      'tipo', 'Lavagem / Lubrificação',
      'regra', 'lavagem_explicita',
      'motivo', null
    );
  end if;

  if v_indicadores ~ '\m(lubrifica|graxa|engrax)' then
    return jsonb_build_object(
      'tipo', 'Lubrificação',
      'regra', 'lubrificacao_explicita',
      'motivo', null
    );
  end if;

  return jsonb_build_object(
    'tipo', null,
    'regra', 'revisao_ambigua',
    'motivo', 'Classificação ambígua; preventiva sem plano conhecido ou texto insuficiente'
  );
end;
$$;
