-- #94 Notifiche push (Web Push): un abbonamento per dispositivo/browser dell'utente.
-- L'endpoint è univoco: se sullo stesso dispositivo accede un altro utente, l'abbonamento passa a lui.
CREATE TABLE push_subscriptions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      VARCHAR(255)  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint     VARCHAR(2048) NOT NULL UNIQUE,
    p256dh       VARCHAR(255)  NOT NULL,
    auth         VARCHAR(255)  NOT NULL,
    user_agent   VARCHAR(512),
    -- Lingua dell'app sul dispositivo al momento dell'attivazione: testi delle notifiche ('it', 'en').
    lang         VARCHAR(10),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX ix_push_subscriptions_user ON push_subscriptions (user_id);
