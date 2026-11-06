package com.example.tripplanner.service;

import com.example.tripplanner.util.AppDates;
import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.repository.TripActivityRepository;
import com.example.tripplanner.repository.TripExpenseRepository;
import com.example.tripplanner.repository.TripPlaceToEatRepository;
import com.example.tripplanner.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final TripActivityRepository activityRepository;
    private final TripPlaceToEatRepository placeRepository;
    private final TripExpenseRepository expenseRepository;

    public TripService(TripRepository tripRepository,
                       TripActivityRepository activityRepository,
                       TripPlaceToEatRepository placeRepository,
                       TripExpenseRepository expenseRepository) {
        this.tripRepository = tripRepository;
        this.activityRepository = activityRepository;
        this.placeRepository = placeRepository;
        this.expenseRepository = expenseRepository;
    }

    @Transactional
    public Trip createTrip(CreateTripRequest request) {
        String decision = request.getDecision();
        if (decision == null) {
            decision = Boolean.TRUE.equals(request.getAsProposal()) ? "proposal" : "confirmed";
        }

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
                .coverCreditName(request.getCoverCreditName())
                .coverCreditUrl(request.getCoverCreditUrl())
                .destinationPlaceId(request.getDestinationPlaceId())
                .destinationIntlName(request.getDestinationIntlName())
                .destinationLat(request.getDestinationLat())
                .destinationLng(request.getDestinationLng())
                .status("planning")
                .decision(decision)
                .proposedBy(request.getProposedBy())
                .votes(request.getVotes() != null ? new ArrayList<>(request.getVotes()) : new ArrayList<>())
                .budgetEstimate(request.getBudgetEstimate() != null ? request.getBudgetEstimate() : 0.0)
                .currency(request.getCurrency() != null ? request.getCurrency() : "EUR")
                .tags(request.getTags() != null && !request.getTags().isEmpty()
                        ? new ArrayList<>(request.getTags())
                        : new ArrayList<>(List.of("Viaggio", "Gourmet")))
                .notes(request.getNotes() != null ? request.getNotes().trim() : "")
                .createdAt(AppDates.todayIso())
                .activities(new ArrayList<>())
                .placesToEat(new ArrayList<>())
                .expenses(new ArrayList<>())
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
            if (request.getDestination() != null) {
                existing.setDestination(request.getDestination().trim());
                // Il luogo (id, nome internazionale, coordinate) segue la destinazione: testo libero = nessun luogo.
                existing.setDestinationPlaceId(request.getDestinationPlaceId());
                existing.setDestinationIntlName(request.getDestinationIntlName());
                existing.setDestinationLat(request.getDestinationLat());
                existing.setDestinationLng(request.getDestinationLng());
            }
            if (request.getCountry() != null)     existing.setCountry(request.getCountry().trim());
            if (request.getStartDate() != null)   existing.setStartDate(request.getStartDate());
            if (request.getEndDate() != null)     existing.setEndDate(request.getEndDate());
            if (request.getCoverUrl() != null) {
                existing.setCoverUrl(request.getCoverUrl());
                // Il credito segue la copertina: una copertina senza credito (es. preset) lo azzera.
                existing.setCoverCreditName(request.getCoverCreditName());
                existing.setCoverCreditUrl(request.getCoverCreditUrl());
            }
            if (request.getStatus() != null)      existing.setStatus(request.getStatus());
            if (request.getDecision() != null)    existing.setDecision(request.getDecision());
            if (request.getProposedBy() != null)  existing.setProposedBy(request.getProposedBy());
            if (request.getBudgetEstimate() != null) existing.setBudgetEstimate(request.getBudgetEstimate());
            if (request.getCurrency() != null)    existing.setCurrency(request.getCurrency());
            if (request.getNotes() != null)       existing.setNotes(request.getNotes().trim());
            if (request.getFlights() != null)     existing.setFlights(request.getFlights());
            if (request.getTransfers() != null)   existing.setTransfers(request.getTransfers());
            if (request.getAccommodation() != null) existing.setAccommodation(request.getAccommodation());

            // Replace votes via clear+addAll
            if (request.getVotes() != null) {
                existing.getVotes().clear();
                existing.getVotes().addAll(request.getVotes());
            }

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

            // Replace expenses via clear+addAll
            if (request.getExpenses() != null) {
                existing.getExpenses().clear();
                for (TripExpense e : request.getExpenses()) {
                    if (e.getId() == null || e.getId().isBlank()) {
                        e.setId("exp_" + UUID.randomUUID().toString().substring(0, 8));
                    }
                    e.setTripId(existing.getId());
                    e.setTrip(existing);
                    existing.getExpenses().add(e);
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

    // ── Expenses ──────────────────────────────────────────────────────────────

    public List<TripExpense> getExpensesByTrip(String tripId) {
        return expenseRepository.findByTripId(tripId);
    }

    @Transactional
    public Optional<TripExpense> addExpense(String tripId, TripExpense expense) {
        return tripRepository.findById(tripId).map(trip -> {
            if (expense.getId() == null || expense.getId().isBlank()) {
                expense.setId("exp_" + UUID.randomUUID().toString().substring(0, 8));
            }
            expense.setTripId(tripId);
            expense.setTrip(trip);
            trip.getExpenses().add(expense);
            tripRepository.save(trip);
            return expense;
        });
    }

    @Transactional
    public Optional<TripExpense> updateExpense(String tripId, String expenseId, TripExpense updated) {
        return expenseRepository.findById(expenseId).flatMap(existing -> {
            if (!tripId.equals(existing.getTripId())) return Optional.empty();
            updated.setId(expenseId);
            updated.setTripId(tripId);
            return Optional.of(expenseRepository.save(updated));
        });
    }

    @Transactional
    public boolean deleteExpense(String tripId, String expenseId) {
        return expenseRepository.findById(expenseId).map(existing -> {
            if (!tripId.equals(existing.getTripId())) return false;
            expenseRepository.deleteById(expenseId);
            return true;
        }).orElse(false);
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    @Transactional
    public Optional<Trip> toggleVote(String tripId, String userId) {
        return tripRepository.findById(tripId).map(trip -> {
            if (trip.getVotes().contains(userId)) {
                trip.getVotes().remove(userId);
            } else {
                trip.getVotes().add(userId);
            }
            return tripRepository.save(trip);
        });
    }
}
