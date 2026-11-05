-- Profilo utente: nome e cognome separati, data di nascita, foto profilo opzionale.
ALTER TABLE users
    ADD COLUMN first_name    VARCHAR(100),
    ADD COLUMN last_name     VARCHAR(100),
    ADD COLUMN birth_date    DATE,
    ADD COLUMN profile_image TEXT;

-- Utenti esistenti: nome = prima parola di "name", cognome = il resto (se c'è).
UPDATE users
SET first_name = split_part(trim(name), ' ', 1),
    last_name  = NULLIF(trim(substring(trim(name) FROM length(split_part(trim(name), ' ', 1)) + 1)), '')
WHERE name IS NOT NULL;
