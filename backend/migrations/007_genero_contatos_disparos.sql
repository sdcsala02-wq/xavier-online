-- Xavier Online 2027
-- Etapa 7A.2D
-- Segmentação de contatos por gênero autodeclarado.
-- Esta migration não habilita o envio de mensagens.

ALTER TABLE public.disparos_contatos
ADD COLUMN IF NOT EXISTS genero VARCHAR(20);

UPDATE public.disparos_contatos
SET genero = 'NAO_INFORMADO'
WHERE genero IS NULL
   OR genero NOT IN (
       'HOMEM',
       'MULHER',
       'NAO_INFORMADO'
   );

ALTER TABLE public.disparos_contatos
ALTER COLUMN genero
SET DEFAULT 'NAO_INFORMADO';

ALTER TABLE public.disparos_contatos
ALTER COLUMN genero
SET NOT NULL;

ALTER TABLE public.disparos_contatos
DROP CONSTRAINT IF EXISTS
    disparos_contatos_genero_check;

ALTER TABLE public.disparos_contatos
ADD CONSTRAINT
    disparos_contatos_genero_check
CHECK (
    genero IN (
        'HOMEM',
        'MULHER',
        'NAO_INFORMADO'
    )
);

CREATE INDEX IF NOT EXISTS
    disparos_contatos_genero_ativo_idx
ON public.disparos_contatos (
    genero,
    ativo
);

COMMENT ON COLUMN
    public.disparos_contatos.genero
IS
    'Gênero autodeclarado para segmentação consentida: HOMEM, MULHER ou NAO_INFORMADO.';
