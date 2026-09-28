package com.example.tripplanner.model;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class FlightDetails {

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "airline",          column = @Column(name = "flight_outbound_airline")),
        @AttributeOverride(name = "flightNumber",     column = @Column(name = "flight_outbound_flight_number")),
        @AttributeOverride(name = "departureAirport", column = @Column(name = "flight_outbound_departure_airport")),
        @AttributeOverride(name = "departureCity",    column = @Column(name = "flight_outbound_departure_city")),
        @AttributeOverride(name = "departureDateTime",column = @Column(name = "flight_outbound_departure_date_time")),
        @AttributeOverride(name = "arrivalAirport",   column = @Column(name = "flight_outbound_arrival_airport")),
        @AttributeOverride(name = "arrivalCity",      column = @Column(name = "flight_outbound_arrival_city")),
        @AttributeOverride(name = "arrivalDateTime",  column = @Column(name = "flight_outbound_arrival_date_time")),
        @AttributeOverride(name = "terminal",         column = @Column(name = "flight_outbound_terminal")),
        @AttributeOverride(name = "gate",             column = @Column(name = "flight_outbound_gate")),
        @AttributeOverride(name = "bookingReference", column = @Column(name = "flight_outbound_booking_reference")),
        @AttributeOverride(name = "baggageNotes",     column = @Column(name = "flight_outbound_baggage_notes", columnDefinition = "text")),
        @AttributeOverride(name = "notes",            column = @Column(name = "flight_outbound_notes", columnDefinition = "text"))
    })
    private FlightInfo outboundFlight;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "airline",          column = @Column(name = "flight_return_airline")),
        @AttributeOverride(name = "flightNumber",     column = @Column(name = "flight_return_flight_number")),
        @AttributeOverride(name = "departureAirport", column = @Column(name = "flight_return_departure_airport")),
        @AttributeOverride(name = "departureCity",    column = @Column(name = "flight_return_departure_city")),
        @AttributeOverride(name = "departureDateTime",column = @Column(name = "flight_return_departure_date_time")),
        @AttributeOverride(name = "arrivalAirport",   column = @Column(name = "flight_return_arrival_airport")),
        @AttributeOverride(name = "arrivalCity",      column = @Column(name = "flight_return_arrival_city")),
        @AttributeOverride(name = "arrivalDateTime",  column = @Column(name = "flight_return_arrival_date_time")),
        @AttributeOverride(name = "terminal",         column = @Column(name = "flight_return_terminal")),
        @AttributeOverride(name = "gate",             column = @Column(name = "flight_return_gate")),
        @AttributeOverride(name = "bookingReference", column = @Column(name = "flight_return_booking_reference")),
        @AttributeOverride(name = "baggageNotes",     column = @Column(name = "flight_return_baggage_notes", columnDefinition = "text")),
        @AttributeOverride(name = "notes",            column = @Column(name = "flight_return_notes", columnDefinition = "text"))
    })
    private FlightInfo returnFlight;
}
