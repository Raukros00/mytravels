package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripActivity {
    private String id;
    private String tripId;
    private String name;
    private String category; // 'monument' | 'museum' | 'nature' | 'experience' | 'shopping' | 'other'
    private String address;
    private GeoPoint coordinates;
    private Boolean ticketsRequired;
    private Double ticketPrice;
    private String currency;
    private Boolean bookingRequired;
    private String bookingUrl;
    private String openingHours;
    private String closingDays;
    private String notes;
    private Integer assignedDay; // null = in backlog, number = assigned to Day X
    private String timeSlot;     // e.g. "10:00 - 12:00"
    private Boolean isCompleted;
}
