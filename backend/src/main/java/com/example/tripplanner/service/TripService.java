package com.example.tripplanner.service;

import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.repository.TripActivityRepository;
import com.example.tripplanner.repository.TripPlaceToEatRepository;
import com.example.tripplanner.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TripActivityRepository activityRepository;
    private final TripPlaceToEatRepository placeRepository;

    public TripService(TripRepository tripRepository,
                       TripActivityRepository activityRepository,
                       TripPlaceToEatRepository placeRepository) {
        this.tripRepository = tripRepository;
        this.activityRepository = activityRepository;
        this.placeRepository = placeRepository;
    }

    @Transactional
    public Trip createTrip(CreateTripRequest request) {
        Trip trip = Trip.builder()
                .id(UUID.randomUUID().toString())
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
                .tags(request.getTags() != null && !request.getTags().isEmpty()
                        ? new ArrayList<>(request.getTags())
                        : new ArrayList<>(List.of("Viaggio", "Gourmet")))
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

    @Transactional
    public Optional<Trip> updateTrip(String id, UpdateTripRequest request) {
        return tripRepository.findById(id).map(existing -> {
            if (request.getTitle() != null)       existing.setTitle(request.getTitle().trim());
            if (request.getDestination() != null) existing.setDestination(request.getDestination().trim());
            if (request.getCountry() != null)     existing.setCountry(request.getCountry().trim());
            if (request.getStartDate() != null)   existing.setStartDate(request.getStartDate());
            if (request.getEndDate() != null)     existing.setEndDate(request.getEndDate());
            if (request.getCoverUrl() != null)    existing.setCoverUrl(request.getCoverUrl());
            if (request.getStatus() != null)      existing.setStatus(request.getStatus());
            if (request.getBudgetEstimate() != null) existing.setBudgetEstimate(request.getBudgetEstimate());
            if (request.getCurrency() != null)    existing.setCurrency(request.getCurrency());
            if (request.getNotes() != null)       existing.setNotes(request.getNotes().trim());
            if (request.getFlights() != null)     existing.setFlights(request.getFlights());
            if (request.getTransfers() != null)   existing.setTransfers(request.getTransfers());
            if (request.getAccommodation() != null) existing.setAccommodation(request.getAccommodation());

            // Replace tags via clear+addAll to avoid reassigning the managed collection
            if (request.getTags() != null) {
                existing.getTags().clear();
                existing.getTags().addAll(request.getTags());
            }

            // Replace activities via clear+addAll — must set back-reference on each new item
            if (request.getActivities() != null) {
                existing.getActivities().clear();
                for (TripActivity a : request.getActivities()) {
                    if (a.getId() == null || a.getId().isBlank()) {
                        a.setId("act_" + UUID.randomUUID().toString().substring(0, 8));
                    }
                    a.setTripId(existing.getId());
                    a.setTrip(existing);
                    existing.getActivities().add(a);
                }
            }

            // Replace placesToEat via clear+addAll
            if (request.getPlacesToEat() != null) {
                existing.getPlacesToEat().clear();
                for (TripPlaceToEat p : request.getPlacesToEat()) {
                    if (p.getId() == null || p.getId().isBlank()) {
                        p.setId("eat_" + UUID.randomUUID().toString().substring(0, 8));
                    }
                    p.setTripId(existing.getId());
                    p.setTrip(existing);
                    existing.getPlacesToEat().add(p);
                }
            }

            return tripRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteTrip(String id) {
        if (tripRepository.existsById(id)) {
            tripRepository.deleteById(id);
            return true;
        }
        return false;
    }

    // ── Activities ────────────────────────────────────────────────────────────

    @Transactional
    public Optional<TripActivity> addActivity(String tripId, TripActivity activity) {
        return tripRepository.findById(tripId).map(trip -> {
            if (activity.getId() == null || activity.getId().isBlank()) {
                activity.setId("act_" + UUID.randomUUID().toString().substring(0, 8));
            }
            activity.setTripId(tripId);
            activity.setTrip(trip);
            trip.getActivities().add(activity);
            tripRepository.save(trip);
            return activity;
        });
    }

    @Transactional
    public Optional<TripActivity> updateActivity(String tripId, String activityId, TripActivity updated) {
        return activityRepository.findById(activityId).flatMap(existing -> {
            if (!tripId.equals(existing.getTripId())) return Optional.empty();
            updated.setId(activityId);
            updated.setTripId(tripId);
            return Optional.of(activityRepository.save(updated));
        });
    }

    @Transactional
    public boolean deleteActivity(String tripId, String activityId) {
        return activityRepository.findById(activityId).map(existing -> {
            if (!tripId.equals(existing.getTripId())) return false;
            activityRepository.deleteById(activityId);
            return true;
        }).orElse(false);
    }

    // ── Places to Eat ─────────────────────────────────────────────────────────

    @Transactional
    public Optional<TripPlaceToEat> addPlaceToEat(String tripId, TripPlaceToEat place) {
        return tripRepository.findById(tripId).map(trip -> {
            if (place.getId() == null || place.getId().isBlank()) {
                place.setId("eat_" + UUID.randomUUID().toString().substring(0, 8));
            }
            place.setTripId(tripId);
            place.setTrip(trip);
            trip.getPlacesToEat().add(place);
            tripRepository.save(trip);
            return place;
        });
    }

    @Transactional
    public Optional<TripPlaceToEat> updatePlaceToEat(String tripId, String placeId, TripPlaceToEat updated) {
        return placeRepository.findById(placeId).flatMap(existing -> {
            if (!tripId.equals(existing.getTripId())) return Optional.empty();
            updated.setId(placeId);
            updated.setTripId(tripId);
            return Optional.of(placeRepository.save(updated));
        });
    }

    @Transactional
    public boolean deletePlaceToEat(String tripId, String placeId) {
        return placeRepository.findById(placeId).map(existing -> {
            if (!tripId.equals(existing.getTripId())) return false;
            placeRepository.deleteById(placeId);
            return true;
        }).orElse(false);
    }

    // ── Logistics ─────────────────────────────────────────────────────────────

    @Transactional
    public Optional<Trip> updateFlights(String tripId, FlightDetails flights) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setFlights(flights);
            return tripRepository.save(trip);
        });
    }

    @Transactional
    public Optional<Trip> updateTransfers(String tripId, AirportTransfer transfers) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setTransfers(transfers);
            return tripRepository.save(trip);
        });
    }

    @Transactional
    public Optional<Trip> updateAccommodation(String tripId, AccommodationDetails accommodation) {
        return tripRepository.findById(tripId).map(trip -> {
            trip.setAccommodation(accommodation);
            return tripRepository.save(trip);
        });
    }
}
