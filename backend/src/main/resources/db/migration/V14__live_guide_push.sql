-- #110 Notifiche push durante il viaggio ("Guida durante il viaggio").
-- Nuova categoria nelle preferenze, attiva di default.
ALTER TABLE push_preferences ADD COLUMN live_guide BOOLEAN NOT NULL DEFAULT TRUE;

-- Registro degli invii: ogni notifica della guida parte una sola volta per (viaggio, utente, tipo, giorno, tappa),
-- anche dopo un riavvio del backend. `ref` è la tappa ("activity:<id>" / "food:<id>") per pasti e chiusure,
-- vuoto per buongiorno e fine giornata.
CREATE TABLE trip_live_notifications_sent (
    trip_id  VARCHAR(255) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id  VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- 'morning' | 'meal' | 'closing' | 'evening'
    kind     VARCHAR(20)  NOT NULL,
    day_date VARCHAR(10)  NOT NULL,
    ref      VARCHAR(300) NOT NULL DEFAULT '',
    sent_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id, kind, day_date, ref)
);
