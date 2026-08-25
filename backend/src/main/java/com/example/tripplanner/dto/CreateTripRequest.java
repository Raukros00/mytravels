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
    private Double budgetEstimate;
    private String currency;
    private List<String> tags;
    private String notes;
}
