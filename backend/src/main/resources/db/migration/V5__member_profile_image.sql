-- Foto profilo dei membri dei gruppi (come nome, avatar e colore, copiata all'ingresso nel gruppo).
ALTER TABLE group_members ADD COLUMN profile_image TEXT;

UPDATE group_members gm
SET profile_image = u.profile_image
FROM users u
WHERE u.id = gm.user_id AND u.profile_image IS NOT NULL;
