-- #97 Preferenze delle notifiche push per tipo, per utente (valgono su tutti i suoi dispositivi).
-- Nessuna riga = valori predefiniti: tutto attivo tranne "nuovi membri".
CREATE TABLE push_preferences (
    user_id     VARCHAR(255) PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    invites     BOOLEAN     NOT NULL DEFAULT TRUE,
    proposals   BOOLEAN     NOT NULL DEFAULT TRUE,
    new_members BOOLEAN     NOT NULL DEFAULT FALSE,
    reminders   BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
