package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlightInfo {
    private String airline;
    private String flightNumber;
    private String departureAirport;
    private String departureCity;
    private String departureDateTime;
    private String arrivalAirport;
    private String arrivalCity;
    private String arrivalDateTime;
    private String terminal;
    private String gate;
    private String bookingReference;
    private String baggageNotes;
    private String notes;
}
