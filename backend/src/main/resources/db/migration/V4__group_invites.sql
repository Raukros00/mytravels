-- Icone come immagini ritagliate (data URL): non stanno in VARCHAR(255)/(50).
ALTER TABLE groups ALTER COLUMN icon TYPE TEXT;
ALTER TABLE notifications ALTER COLUMN group_icon TYPE TEXT;

-- Notifiche: chi le ha generate e, per le richieste di accesso, a quale richiesta si riferiscono.
ALTER TABLE notifications
    ADD COLUMN sender_id  VARCHAR(255),
    ADD COLUMN request_id VARCHAR(255);

-- Richieste di accesso a un gruppo (da link o codice invito), approvate o rifiutate da un admin.
CREATE TABLE group_join_requests (
    id            VARCHAR(255) PRIMARY KEY,
    group_id      VARCHAR(255) NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id       VARCHAR(255) NOT NULL,
    user_name     VARCHAR(255),
    avatar        VARCHAR(255),
    color         VARCHAR(50),
    profile_image TEXT,
    status        VARCHAR(20)  NOT NULL,
    created_at    VARCHAR(50),
    decided_at    VARCHAR(50),
    decided_by    VARCHAR(255)
);

-- Al massimo una richiesta in attesa per utente e gruppo.
CREATE UNIQUE INDEX ux_group_join_requests_pending
    ON group_join_requests (group_id, user_id)
    WHERE status = 'pending';

CREATE INDEX ix_group_join_requests_group_status ON group_join_requests (group_id, status);
