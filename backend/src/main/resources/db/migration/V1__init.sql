-- V1__init.sql : schema relazionale iniziale per Trip Planner

CREATE TABLE users (
    id          VARCHAR(255) PRIMARY KEY,
    name        VARCHAR(255),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255),
    avatar      VARCHAR(255),
    color       VARCHAR(50),
    role        VARCHAR(50),
    joined_date VARCHAR(50)
);

CREATE TABLE groups (
    id          VARCHAR(255) PRIMARY KEY,
    name        VARCHAR(255),
    description TEXT,
    icon        VARCHAR(255),
    color       VARCHAR(50),
    creator_id  VARCHAR(255),
    invite_code VARCHAR(50) NOT NULL UNIQUE,
    created_at  VARCHAR(50),
    CONSTRAINT fk_groups_creator
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE group_members (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id    VARCHAR(255) NOT NULL,
    user_id     VARCHAR(255) NOT NULL,
    member_name VARCHAR(255),
    avatar      VARCHAR(255),
    role        VARCHAR(50),
    color       VARCHAR(50),
    CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_gm_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT uq_gm_group_user UNIQUE (group_id, user_id)
);
CREATE INDEX idx_gm_group ON group_members(group_id);
CREATE INDEX idx_gm_user  ON group_members(user_id);

CREATE TABLE trips (
    id              VARCHAR(255) PRIMARY KEY,
    group_id        VARCHAR(255) NOT NULL,
    title           VARCHAR(255),
    destination     VARCHAR(255),
    country         VARCHAR(255),
    start_date      VARCHAR(50),
    end_date        VARCHAR(50),
    cover_url       TEXT,
    status          VARCHAR(50),
    currency        VARCHAR(10),
    notes           TEXT,
    created_at      VARCHAR(50),
    budget_estimate DOUBLE PRECISION,

    -- flights: outbound
    flight_outbound_airline              VARCHAR(255),
    flight_outbound_flight_number        VARCHAR(100),
    flight_outbound_departure_airport    VARCHAR(100),
    flight_outbound_departure_city       VARCHAR(255),
    flight_outbound_departure_date_time  VARCHAR(50),
    flight_outbound_arrival_airport      VARCHAR(100),
    flight_outbound_arrival_city         VARCHAR(255),
    flight_outbound_arrival_date_time    VARCHAR(50),
    flight_outbound_terminal             VARCHAR(50),
    flight_outbound_gate                 VARCHAR(50),
    flight_outbound_booking_reference    VARCHAR(100),
    flight_outbound_baggage_notes        TEXT,
    flight_outbound_notes                TEXT,

    -- flights: return
    flight_return_airline                VARCHAR(255),
    flight_return_flight_number          VARCHAR(100),
    flight_return_departure_airport      VARCHAR(100),
    flight_return_departure_city         VARCHAR(255),
    flight_return_departure_date_time    VARCHAR(50),
    flight_return_arrival_airport        VARCHAR(100),
    flight_return_arrival_city           VARCHAR(255),
    flight_return_arrival_date_time      VARCHAR(50),
    flight_return_terminal               VARCHAR(50),
    flight_return_gate                   VARCHAR(50),
    flight_return_booking_reference      VARCHAR(100),
    flight_return_baggage_notes          TEXT,
    flight_return_notes                  TEXT,

    -- transfers
    transfer_recommended_option          VARCHAR(50),
    transfer_pass_required               BOOLEAN,
    transfer_pass_details                TEXT,
    transfer_special_tickets             TEXT,
    transfer_taxi_vs_uber_advice         TEXT,
    transfer_estimated_cost              VARCHAR(100),
    transfer_estimated_duration          VARCHAR(100),
    transfer_instructions                TEXT,

    -- accommodation
    accom_name              VARCHAR(255),
    accom_address           TEXT,
    accom_lat               DOUBLE PRECISION,
    accom_lng               DOUBLE PRECISION,
    accom_check_in_date     VARCHAR(50),
    accom_check_in_time     VARCHAR(50),
    accom_check_out_date    VARCHAR(50),
    accom_check_out_time    VARCHAR(50),
    accom_booking_code      VARCHAR(100),
    accom_phone_or_contact  VARCHAR(255),
    accom_notes             TEXT,

    CONSTRAINT fk_trips_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
CREATE INDEX idx_trips_group ON trips(group_id);

CREATE TABLE trip_tags (
    trip_id   VARCHAR(255) NOT NULL,
    tag       VARCHAR(100),
    tag_order INT NOT NULL,
    CONSTRAINT pk_trip_tags PRIMARY KEY (trip_id, tag_order),
    CONSTRAINT fk_tags_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE trip_activities (
    id               VARCHAR(255) PRIMARY KEY,
    trip_id          VARCHAR(255) NOT NULL,
    name             VARCHAR(255),
    category         VARCHAR(50),
    address          TEXT,
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    tickets_required BOOLEAN,
    ticket_price     DOUBLE PRECISION,
    currency         VARCHAR(10),
    booking_required BOOLEAN,
    booking_url      TEXT,
    opening_hours    VARCHAR(255),
    closing_days     VARCHAR(255),
    notes            TEXT,
    assigned_day     INTEGER,
    time_slot        VARCHAR(50),
    is_completed     BOOLEAN,
    CONSTRAINT fk_act_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);
CREATE INDEX idx_act_trip ON trip_activities(trip_id);

CREATE TABLE trip_places_to_eat (
    id               VARCHAR(255) PRIMARY KEY,
    trip_id          VARCHAR(255) NOT NULL,
    name             VARCHAR(255),
    category         VARCHAR(50),
    price_range      VARCHAR(20),
    address          TEXT,
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    specialties      TEXT,
    booking_required BOOLEAN,
    opening_hours    VARCHAR(255),
    closing_days     VARCHAR(255),
    notes            TEXT,
    assigned_day     INTEGER,
    assigned_meal    VARCHAR(50),
    time_slot        VARCHAR(50),
    is_visited       BOOLEAN,
    CONSTRAINT fk_eat_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);
CREATE INDEX idx_eat_trip ON trip_places_to_eat(trip_id);
