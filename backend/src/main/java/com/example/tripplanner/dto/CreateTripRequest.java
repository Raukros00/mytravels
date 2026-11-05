package com.example.tripplanner.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateTripRequest {
    @NotBlank
    private String groupId;

    @NotBlank
    private String title;

    @NotBlank
    private String destination;

    private String country;
    private String startDate;
    private String endDate;
    private String coverUrl;
    private String coverCreditName;
    private String coverCreditUrl;
    private String destinationPlaceId;
    private String destinationIntlName;
    private Double destinationLat;
    private Double destinationLng;
    private Double budgetEstimate;
    private String currency;
    private List<String> tags;
    private String notes;
    private Boolean asProposal;
    private String decision;
    private String proposedBy;
    private List<String> votes;
}
