-- Destinazione scelta dai suggerimenti (GeoNames): id del luogo, nome internazionale e coordinate.
ALTER TABLE trips
    ADD COLUMN destination_place_id  VARCHAR(50),
    ADD COLUMN destination_intl_name VARCHAR(255),
    ADD COLUMN destination_lat       DOUBLE PRECISION,
    ADD COLUMN destination_lng       DOUBLE PRECISION;
