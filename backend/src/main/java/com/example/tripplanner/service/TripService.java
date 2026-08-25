package com.example.tripplanner.service;

import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.repository.TripRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TripService {

    private final TripRepository tripRepository;

    public TripService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    public Trip createTrip(CreateTripRequest request) {
        Trip trip = Trip.builder()
                .groupId(request.getGroupId())
                .title(request.getTitle().trim())
                .destination(request.getDestination().trim())
                .country(request.getCountry() != null ? request.getCountry().trim() : "")
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .coverUrl(request.getCoverUrl() != null && !request.getCoverUrl().isBlank() 
                        ? request.getCoverUrl() 
                        : "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80")
                .status("planning")
                .budgetEstimate(request.getBudgetEstimate() != null ? request.getBudgetEstimate() : 0.0)
                .currency(request.getCurrency() != null ? request.getCurrency() : "EUR")
                .tags(request.getTags() != null && !request.getTags().isEmpty() ? request.getTags() : List.of("Viaggio", "Gourmet"))
                .notes(request.getNotes() != null ? request.getNotes().trim() : "")
                .createdAt(Instant.now().toString().split("T")[0])
                .activities(new ArrayList<>())
                .placesToEat(new ArrayList<>())
                .build();

        return tripRepository.save(trip);
    }

    public Optional<Trip> getTrip(String id) {
        return tripRepository.findById(id);
    }

    public List<Trip> getTripsByGroupId(String groupId) {
        return tripRepository.findByGroupId(groupId);
    }

    public List<Trip> getAllTrips() {
        return tripRepository.findAll();
    }

    public Optional<Trip> updateTrip(String id, UpdateTripRequest request) {
        return tripRepository.findById(id).map(existing -> {
            if (request.getTitle() != null) existing.setTitle(request.getTitle().trim());
            if (request.getDestination() != null) existing.setDestination(request.getDestination().trim());
            if (request.getCountry() != null) existing.setCountry(request.getCountry().trim());
            if (request.getStartDate() != null) existing.setStartDate(request.getStartDate());
            if (request.getEndDate() != null) existing.setEndDate(request.getEndDate());
            if (request.getCoverUrl() != null) existing.setCoverUrl(request.getCoverUrl());
            if (request.getStatus() != null) existing.setStatus(request.getStatus());
            if (request.getBudgetEstimate() != null) existing.setBudgetEstimate(request.getBudgetEstimate());
            if (request.getCurrency() != null) existing.setCurrency(request.getCurrency());
            if (request.getTags() != null) existing.setTags(request.getTags());
            if (request.getNotes() != null) existing.setNotes(request.getNotes().trim());
            if (request.getActivities() != null) existing.setActivities(request.getActivities());
            if (request.getPlacesToEat() != null) existing.setPlacesToEat(request.getPlacesToEat());
            if (request.getFlights() != null) existing.setFlights(request.getFlights());
            if (request.getTransfers() != null) existing.setTransfers(request.getTransfers());
            if (request.getAccommodation() != null) existing.setAccommodation(request.getAccommodation());
            return tripRepository.save(existing);
        });
    }

    public boolean deleteTrip(String id) {
        if (tripRepository.existsById(id)) {
            tripRepository.deleteById(id);
            return true;
        }
        return false;
    }

    // Activities
    public Optional<TripActivity> addActivity(String tripId, TripActivity activity) {
        return tripRepository.findById(tripId).map(trip -> {
            if (activity.getId() == null || activity.getId().isBlank()) {
                activity.setId("act_" + UUID.randomUUID().toString().substring(0, 8));
            }
            activity.setTripId(tripId);
            if (trip.getActivities() == null) {
                trip.setActivities(new ArrayList<>());
            }
            trip.getActivities().add(activity);
            tripRepository.save(trip);
            return activity;
        });
    }

    public Optional<TripActivity> updateActivity(String tripId, String activityId, TripActivity updated) {
        return tripRepository.findById(tripId).flatMap(trip -> {
            if (trip.getActivities() == null) return Optional.empty();
            for (int i = 0; i < trip.getActivities().size(); i++) {
                TripActivity curr = trip.getActivities().get(i);
                if (curr.getId().equals(activityId)) {
                    updated.setId(activityId);
                    updated.setTripId(tripId);
                    trip.getActivities().set(i, updated);
                    tripRepository.save(trip);
                    return Optional.of(updated);
                }
            }
            return Optional.empty();
        });
    }

    public boolean deleteActivity(String tripId, String activityId) {
        Optional<Trip> opt = tripRepository.findById(tripId);
        if (opt.isPresent()) {
            Trip trip = opt.get();
            if (trip.getActivities() != null) {
                boolean removed = trip.getActivities().removeIf(a -> a.getId().equals(activityId));
                if (removed) {
                    tripRepository.save(trip);
                    return true;
                }
            }
        }
        return false;
    }

    // Places to Eat
    public Optional<TripPlaceToEat> addPlaceToEat(String tripId, TripPlaceToEat place) {
        return tripRepository.findById(tripId).map(trip -> {
            if (place.getId() == null || place.getId().isBlank()) {
                place.setId("eat_" + UUID.randomUUID().toString().substring(0, 8));
            }
            place.setTripId(tripId);
            if (trip.getPlacesToEat() == null) {
                trip.setPlacesToEat(new ArrayList<>());
            }
            trip.getPlacesToEat().add(place);
            tripRepository.save(trip);
            return place;
        });
    }

    public Optional<TripPlaceToEat> updatePlaceToEat(String tripId, String placeId, TripPlaceToEat updated) {
        return tripRepository.findById(tripId).flatMap(trip -> {
            if (trip.getPlacesToEat() == null) return Optional.empty();
            for (int i = 0; i < trip.getPlacesToEat().size(); i++) {
                TripPlaceToEat curr = trip.getPlacesToEat().get(i);
                if (curr.getId().equals(placeId)) {
                    updated.setId(placeId);
                    updated.setTripId(tripId);
                    trip.getPlacesToEat().set(i, updated);
                    tripRepository.save(trip);
                    return Optional.of(updated);
                }
            }
            return Optional.empty();
        });
    }

    public boolean deletePlaceToEat(String tripId, String placeId) {
        Optional<Trip> opt = tripRepository.findById(tripId);
        if (opt.isPresent()) {
            Trip trip = opt.get();
            if (trip.getPlacesToEat() != null) {
                boolean removed = trip.getPlacesToEat().removeIf(p -> p.getId().equals(placeId));
                if (removed) {
                    tripRepository.save(trip);
                    return true;
                }
            }
        }
        return false;
    }

    // Logistics
    public Optional<Trip> updateFlights(String tripId, FlightDetails flights) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setFlights(flights);
            return tripRepository.save(trip);
        });
    }

    public Optional<Trip> updateTransfers(String tripId, AirportTransfer transfers) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setTransfers(transfers);
            return tripRepository.save(trip);
        });
    }

    public Optional<Trip> updateAccommodation(String tripId, AccommodationDetails accommodation) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setAccommodation(accommodation);
            return tripRepository.save(trip);
        });
    }
}
