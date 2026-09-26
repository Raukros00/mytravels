package com.example.tripplanner.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class FlightInfo {
    private String airline;
    @Column(name = "flight_number") private String flightNumber;
    @Column(name = "departure_airport") private String departureAirport;
    @Column(name = "departure_city") private String departureCity;
    @Column(name = "departure_date_time") private String departureDateTime;
    @Column(name = "arrival_airport") private String arrivalAirport;
    @Column(name = "arrival_city") private String arrivalCity;
    @Column(name = "arrival_date_time") private String arrivalDateTime;
    private String terminal;
    private String gate;
    @Column(name = "booking_reference") private String bookingReference;
    @Column(name = "baggage_notes", columnDefinition = "text") private String baggageNotes;
    @Column(columnDefinition = "text") private String notes;
}
