-- #103 Modalità "In viaggio": una tappa può essere "saltata" (azione "Salta" della guida della giornata).
-- Stato separato da is_completed / is_visited: una tappa saltata non è fatta, ma nemmeno da fare oggi;
-- la #112 la mostra tra quelle "da recuperare" e la azzera quando viene spostata in un altro giorno.
ALTER TABLE trip_activities    ADD COLUMN is_skipped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE trip_places_to_eat ADD COLUMN is_skipped BOOLEAN NOT NULL DEFAULT FALSE;
