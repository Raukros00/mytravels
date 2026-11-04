-- V2__fe_be_alignment.sql : Aggiornamento schema per allineamento FE-BE
-- Aggiunge supporto a:
-- 1. Proposte e votazioni per viaggi (decision, proposed_by, trip_votes)
-- 2. Spese condivise (trip_expenses, trip_expense_split_among, trip_expense_shares)
-- 3. Impostazioni gruppo (currency, archived, group_muted_users)
-- 4. Notifiche (notifications)

-- 1. Modifiche a TRIPS
ALTER TABLE trips ADD COLUMN IF NOT EXISTS decision VARCHAR(50) DEFAULT 'confirmed';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS proposed_by VARCHAR(255);

CREATE TABLE IF NOT EXISTS trip_votes (
    trip_id   VARCHAR(255) NOT NULL,
    voter_id  VARCHAR(255) NOT NULL,
    CONSTRAINT pk_trip_votes PRIMARY KEY (trip_id, voter_id),
    CONSTRAINT fk_votes_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_votes_trip ON trip_votes(trip_id);

-- 2. Modifiche a GROUPS
ALTER TABLE groups ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'EUR';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS group_muted_users (
    group_id VARCHAR(255) NOT NULL,
    user_id  VARCHAR(255) NOT NULL,
    CONSTRAINT pk_group_muted PRIMARY KEY (group_id, user_id),
    CONSTRAINT fk_muted_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_muted_group ON group_muted_users(group_id);

-- 3. Tabella TRIP_EXPENSES e tabelle collegate
CREATE TABLE IF NOT EXISTS trip_expenses (
    id          VARCHAR(255) PRIMARY KEY,
    trip_id     VARCHAR(255) NOT NULL,
    title       VARCHAR(255),
    amount      DOUBLE PRECISION NOT NULL,
    category    VARCHAR(50),
    date        VARCHAR(50),
    paid_by     VARCHAR(255),
    type        VARCHAR(50) DEFAULT 'expense',
    notes       TEXT,
    CONSTRAINT fk_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_expenses_trip ON trip_expenses(trip_id);

CREATE TABLE IF NOT EXISTS trip_expense_split_among (
    expense_id VARCHAR(255) NOT NULL,
    member_id  VARCHAR(255) NOT NULL,
    CONSTRAINT pk_expense_split PRIMARY KEY (expense_id, member_id),
    CONSTRAINT fk_split_expense FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_split_expense ON trip_expense_split_among(expense_id);

CREATE TABLE IF NOT EXISTS trip_expense_shares (
    expense_id   VARCHAR(255) NOT NULL,
    member_id    VARCHAR(255) NOT NULL,
    share_amount DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_expense_shares PRIMARY KEY (expense_id, member_id),
    CONSTRAINT fk_shares_expense FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shares_expense ON trip_expense_shares(expense_id);

-- 4. Tabella NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id           VARCHAR(255) PRIMARY KEY,
    type         VARCHAR(50),
    recipient_id VARCHAR(255) NOT NULL,
    sender_name  VARCHAR(255),
    group_id     VARCHAR(255),
    group_name   VARCHAR(255),
    group_icon   VARCHAR(50),
    group_color  VARCHAR(50),
    created_at   VARCHAR(50),
    read         BOOLEAN NOT NULL DEFAULT FALSE,
    status       VARCHAR(50) DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
