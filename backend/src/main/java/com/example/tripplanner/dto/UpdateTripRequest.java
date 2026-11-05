package com.example.tripplanner.dto;

import com.example.tripplanner.model.AccommodationDetails;
import com.example.tripplanner.model.AirportTransfer;
import com.example.tripplanner.model.FlightDetails;
import com.example.tripplanner.model.TripActivity;
import com.example.tripplanner.model.TripExpense;
import com.example.tripplanner.model.TripPlaceToEat;
import lombok.Data;

import java.util.List;

@Data
public class UpdateTripRequest {
    private String title;
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
    private String status;
    private String decision;
    private String proposedBy;
    private List<String> votes;
    private Double budgetEstimate;
    private String currency;
    private List<String> tags;
    private String notes;
    private List<TripActivity> activities;
    private List<TripPlaceToEat> placesToEat;
    private List<TripExpense> expenses;
    private FlightDetails flights;
    private AirportTransfer transfers;
    private AccommodationDetails accommodation;
}
