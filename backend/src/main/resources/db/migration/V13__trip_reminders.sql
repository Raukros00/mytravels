-- #99 Promemoria push prima della partenza: un promemoria per (viaggio, utente, tipo, data di partenza)
-- viene inviato una sola volta, anche dopo un riavvio del backend. La data di partenza fa parte della
-- chiave: se il viaggio viene spostato, i promemoria della nuova data partono di nuovo.
CREATE TABLE trip_reminders_sent (
    trip_id    VARCHAR(255) NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id    VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- 'three_days' (3 giorni prima) | 'day_before' (il giorno prima)
    kind       VARCHAR(20)  NOT NULL,
    start_date VARCHAR(10)  NOT NULL,
    sent_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id, kind, start_date)
);
