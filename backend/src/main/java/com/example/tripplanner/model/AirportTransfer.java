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
public class AirportTransfer {
    @Column(name = "transfer_recommended_option") private String recommendedOption;
    @Column(name = "transfer_pass_required")      private Boolean passRequired;
    @Column(name = "transfer_pass_details", columnDefinition = "text") private String passDetails;
    @Column(name = "transfer_special_tickets", columnDefinition = "text") private String specialTickets;
    @Column(name = "transfer_taxi_vs_uber_advice", columnDefinition = "text") private String taxiVsUberAdvice;
    @Column(name = "transfer_estimated_cost")     private String estimatedCost;
    @Column(name = "transfer_estimated_duration") private String estimatedDuration;
    @Column(name = "transfer_instructions", columnDefinition = "text") private String instructions;
}
