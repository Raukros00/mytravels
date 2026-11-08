-- #66 Email non sensibile a maiuscole/minuscole.
--
-- Da questa versione l'app salva e cerca le email già normalizzate (trim + minuscolo).
-- Questa migrazione allinea le email esistenti in modo prudente:
--
-- 1. Porta in minuscolo (e senza spazi iniziali/finali) solo le email che NON entrano in conflitto
--    con un altro account: se due account differiscono solo per maiuscole/minuscole o spazi
--    (es. "Mario@x.it" e "mario@x.it"), entrambi restano INVARIATI e vanno sistemati a mano.
--    Quegli account continuano ad accedere scrivendo l'email esattamente come salvata.
-- 2. Crea l'indice univoco su lower(email) solo se non ci sono più duplicati; altrimenti lo salta
--    con un WARNING nei log (il deploy non fallisce) e andrà creato con una migrazione successiva
--    dopo aver risolto i conflitti.
--
-- È idempotente: rieseguita non cambia nulla (le email sono già normalizzate, l'indice usa IF NOT EXISTS).

UPDATE users u
SET email = lower(btrim(u.email))
WHERE u.email <> lower(btrim(u.email))
  AND NOT EXISTS (
      SELECT 1 FROM users o
      WHERE o.id <> u.id
        AND lower(btrim(o.email)) = lower(btrim(u.email))
  );

DO $$
DECLARE
    conflicts integer;
BEGIN
    SELECT count(*) INTO conflicts
    FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) d;

    IF conflicts = 0 THEN
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
    ELSE
        RAISE WARNING 'V8: % email presenti in più account che differiscono solo per maiuscole/minuscole: '
                      'righe lasciate invariate e indice univoco su lower(email) NON creato.', conflicts;
    END IF;
END $$;
