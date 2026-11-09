-- #121 Eliminazione dell'account: i contenuti del gruppo (viaggi, spese, proposte) restano e possono
-- ancora riferirsi all'id dell'utente eliminato (chi ha pagato, divisioni, autore della proposta, voti).
-- Qui si ricorda solo quali id del gruppo appartengono a un account eliminato, per mostrare
-- "Utente eliminato" invece di "Ex membro". Nessun dato personale: solo l'id casuale (UUID).
CREATE TABLE group_deleted_members (
    group_id VARCHAR(255) NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id  VARCHAR(255) NOT NULL,
    PRIMARY KEY (group_id, user_id)
);
