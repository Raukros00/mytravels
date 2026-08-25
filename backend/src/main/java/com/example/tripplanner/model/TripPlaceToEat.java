package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripPlaceToEat {
    private String id;
    private String tripId;
    private String name;
    private String category; // 'lunch' | 'dinner' | 'snack' | 'breakfast' | 'aperitivo'
    private String priceRange; // '€' | '€€' | '€€€' | '€€€€'
    private String address;
    private GeoPoint coordinates;
    private String specialties;
    private Boolean bookingRequired;
    private String openingHours;
    private String closingDays;
    private String notes;
    private Integer assignedDay;
    private String assignedMeal;
    private String timeSlot;
    private Boolean isVisited;
}
