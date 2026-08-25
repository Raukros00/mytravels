package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "trips")
public class Trip {
    @Id
    private String id;
    private String groupId;
    private String title;
    private String destination;
    private String country;
    private String startDate; // YYYY-MM-DD
    private String endDate;   // YYYY-MM-DD
    private String coverUrl;
    private String status;    // 'planning' | 'upcoming' | 'ongoing' | 'completed'
    private Double budgetEstimate;
    private String currency;
    
    @Builder.Default
    private List<String> tags = new ArrayList<>();
    
    private String notes;
    
    @Builder.Default
    private String createdAt = Instant.now().toString();

    @Builder.Default
    private List<TripActivity> activities = new ArrayList<>();

    @Builder.Default
    private List<TripPlaceToEat> placesToEat = new ArrayList<>();

    private FlightDetails flights;
    private AirportTransfer transfers;
    private AccommodationDetails accommodation;
}
