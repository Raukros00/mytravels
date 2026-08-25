package com.example.tripplanner.controller;

import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.service.TripService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/trips")
public class TripController {

    private final TripService tripService;

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @PostMapping
    public ResponseEntity<Trip> createTrip(@Valid @RequestBody CreateTripRequest request) {
        Trip created = tripService.createTrip(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<Trip>> getAllTrips() {
        return ResponseEntity.ok(tripService.getAllTrips());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Trip> getTripById(@PathVariable String id) {
        Optional<Trip> tripOpt = tripService.getTrip(id);
        return tripOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<Trip>> getTripsByGroup(@PathVariable String groupId) {
        return ResponseEntity.ok(tripService.getTripsByGroupId(groupId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable String id, @RequestBody UpdateTripRequest request) {
        Optional<Trip> updated = tripService.updateTrip(id, request);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTrip(@PathVariable String id) {
        boolean deleted = tripService.deleteTrip(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Trip deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    // Sub-resources: Activities
    @PostMapping("/{id}/activities")
    public ResponseEntity<TripActivity> addActivity(@PathVariable String id, @RequestBody TripActivity activity) {
        Optional<TripActivity> created = tripService.addActivity(id, activity);
        return created.map(a -> ResponseEntity.status(HttpStatus.CREATED).body(a))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/activities/{activityId}")
    public ResponseEntity<TripActivity> updateActivity(@PathVariable String id,
                                                       @PathVariable String activityId,
                                                       @RequestBody TripActivity activity) {
        Optional<TripActivity> updated = tripService.updateActivity(id, activityId, activity);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}/activities/{activityId}")
    public ResponseEntity<?> deleteActivity(@PathVariable String id, @PathVariable String activityId) {
        boolean deleted = tripService.deleteActivity(id, activityId);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Activity deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    // Sub-resources: Places to Eat
    @PostMapping("/{id}/places-to-eat")
    public ResponseEntity<TripPlaceToEat> addPlaceToEat(@PathVariable String id, @RequestBody TripPlaceToEat place) {
        Optional<TripPlaceToEat> created = tripService.addPlaceToEat(id, place);
        return created.map(p -> ResponseEntity.status(HttpStatus.CREATED).body(p))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/places-to-eat/{placeId}")
    public ResponseEntity<TripPlaceToEat> updatePlaceToEat(@PathVariable String id,
                                                           @PathVariable String placeId,
                                                           @RequestBody TripPlaceToEat place) {
        Optional<TripPlaceToEat> updated = tripService.updatePlaceToEat(id, placeId, place);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}/places-to-eat/{placeId}")
    public ResponseEntity<?> deletePlaceToEat(@PathVariable String id, @PathVariable String placeId) {
        boolean deleted = tripService.deletePlaceToEat(id, placeId);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Place to eat deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    // Sub-resources: Flights, Transfers, Accommodation
    @PutMapping("/{id}/flights")
    public ResponseEntity<Trip> updateFlights(@PathVariable String id, @RequestBody FlightDetails flights) {
        Optional<Trip> updated = tripService.updateFlights(id, flights);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/transfers")
    public ResponseEntity<Trip> updateTransfers(@PathVariable String id, @RequestBody AirportTransfer transfers) {
        Optional<Trip> updated = tripService.updateTransfers(id, transfers);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/accommodation")
    public ResponseEntity<Trip> updateAccommodation(@PathVariable String id, @RequestBody AccommodationDetails accommodation) {
        Optional<Trip> updated = tripService.updateAccommodation(id, accommodation);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
