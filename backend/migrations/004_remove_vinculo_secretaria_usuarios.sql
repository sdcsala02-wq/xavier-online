BEGIN;

UPDATE public.usuarios
SET perfil = 'CONSULTA',
    secretaria = NULL
WHERE perfil = 'SECRETARIA';

ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_secretaria_obrigatoria_check;

ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS usuarios_perfil_valido_check;

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_perfil_valido_check
    CHECK (
        perfil IN (
            'ADMIN',
            'ASSESSOR',
            'ATENDENTE',
            'CONSULTA',
            'LIDERANCA'
        )
    );

DROP INDEX IF EXISTS public.usuarios_secretaria_ativo_idx;

ALTER TABLE public.usuarios
    DROP COLUMN IF EXISTS secretaria;

COMMIT;
