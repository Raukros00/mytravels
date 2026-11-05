-- Credito del fotografo per le copertine prese da Unsplash (obbligatorio da mostrare insieme alla foto).
ALTER TABLE trips
    ADD COLUMN cover_credit_name VARCHAR(255),
    ADD COLUMN cover_credit_url  TEXT;
