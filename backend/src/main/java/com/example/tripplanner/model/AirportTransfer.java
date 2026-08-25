package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AirportTransfer {
    private String recommendedOption; // 'metro' | 'train' | 'bus' | 'taxi' | 'uber' | 'other'
    private Boolean passRequired;
    private String passDetails;
    private String specialTickets;
    private String taxiVsUberAdvice;
    private String estimatedCost;
    private String estimatedDuration;
    private String instructions;
}
