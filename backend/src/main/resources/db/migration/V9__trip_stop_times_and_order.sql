-- #101 Orari strutturati e ordine delle tappe nella giornata (attività e ristoranti).
--   start_time / end_time: 'HH:mm', facoltativi (end_time solo insieme a start_time e dopo di esso).
--   day_order: posizione nella giornata decisa dall'utente; NULL = posizionata in base all'orario.
ALTER TABLE trip_activities
    ADD COLUMN start_time VARCHAR(5),
    ADD COLUMN end_time   VARCHAR(5),
    ADD COLUMN day_order  INTEGER;

ALTER TABLE trip_places_to_eat
    ADD COLUMN start_time VARCHAR(5),
    ADD COLUMN end_time   VARCHAR(5),
    ADD COLUMN day_order  INTEGER;

-- Conversione delle fasce orarie scritte a mano che si riconoscono: "10:00 - 12:30", "10.00-12.30",
-- "9:30", "13:00 – 14:00" (trattino, en dash o em dash). Restituisce {inizio, fine} oppure NULL.
-- Stesse regole di TimeSlots.parse (backend) e parseTimeSlot (frontend).
-- Una fine non successiva all'inizio (es. "22:00 - 01:00") viene scartata e resta solo l'inizio.
-- Il testo originale resta in time_slot; le fasce non riconoscibili (es. "mattina") restano intatte.
CREATE FUNCTION wb_parse_time_slot(slot TEXT) RETURNS TEXT[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    m TEXT[];
    s TEXT;
    e TEXT;
BEGIN
    IF slot IS NULL THEN
        RETURN NULL;
    END IF;
    m := regexp_match(slot, '^\s*(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?\s*$');
    IF m IS NULL OR m[1]::INT > 23 OR m[2]::INT > 59 THEN
        RETURN NULL;
    END IF;
    IF m[3] IS NOT NULL AND (m[3]::INT > 23 OR m[4]::INT > 59) THEN
        RETURN NULL;
    END IF;
    s := lpad(m[1], 2, '0') || ':' || m[2];
    IF m[3] IS NOT NULL THEN
        e := lpad(m[3], 2, '0') || ':' || m[4];
        IF e <= s THEN
            e := NULL;
        END IF;
    END IF;
    RETURN ARRAY[s, e];
END;
$$;

UPDATE trip_activities
SET start_time = (wb_parse_time_slot(time_slot))[1],
    end_time   = (wb_parse_time_slot(time_slot))[2]
WHERE wb_parse_time_slot(time_slot) IS NOT NULL;

UPDATE trip_places_to_eat
SET start_time = (wb_parse_time_slot(time_slot))[1],
    end_time   = (wb_parse_time_slot(time_slot))[2]
WHERE wb_parse_time_slot(time_slot) IS NOT NULL;

DROP FUNCTION wb_parse_time_slot(TEXT);
