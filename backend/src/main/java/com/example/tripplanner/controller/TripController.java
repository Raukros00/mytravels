package com.example.tripplanner.controller;

import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.TripService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/trips")
public class TripController {

    private final TripService tripService;
    private final GroupAccess groupAccess;

    public TripController(TripService tripService, GroupAccess groupAccess) {
        this.tripService = tripService;
        this.groupAccess = groupAccess;
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

    // Ordine delle tappe nella giornata (#101)

    public record DayOrderRequest(List<TripService.DayStopRef> items) {
    }

    /**
     * Salva l'ordine delle tappe (attività e ristoranti) del giorno {@code day}, nell'ordine dell'elenco
     * {@code {"items":[{"type":"activity"|"food","id":"..."}]}}. Solo per i membri del gruppo del viaggio.
     * 400 se una tappa non è del viaggio o non è in quel giorno.
     */
    @PutMapping("/{id}/days/{day}/order")
    public ResponseEntity<?> reorderDay(@PathVariable String id,
                                        @PathVariable int day,
                                        @RequestBody DayOrderRequest body,
                                        Authentication auth) {
        Optional<Trip> trip = tripService.getTrip(id);
        if (trip.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        if (groupAccess.memberGroup(trip.get().getGroupId(), auth).isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Forbidden", "message", "Solo i membri del gruppo possono modificare il viaggio"));
        }
        return tripService.reorderDay(id, day, body != null ? body.items() : null)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
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

    // Sub-resources: Expenses
    @GetMapping("/{id}/expenses")
    public ResponseEntity<List<TripExpense>> getExpenses(@PathVariable String id) {
        return ResponseEntity.ok(tripService.getExpensesByTrip(id));
    }

    @PostMapping("/{id}/expenses")
    public ResponseEntity<TripExpense> addExpense(@PathVariable String id, @RequestBody TripExpense expense) {
        Optional<TripExpense> created = tripService.addExpense(id, expense);
        return created.map(e -> ResponseEntity.status(HttpStatus.CREATED).body(e))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/expenses/{expenseId}")
    public ResponseEntity<TripExpense> updateExpense(@PathVariable String id,
                                                     @PathVariable String expenseId,
                                                     @RequestBody TripExpense expense) {
        Optional<TripExpense> updated = tripService.updateExpense(id, expenseId, expense);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}/expenses/{expenseId}")
    public ResponseEntity<?> deleteExpense(@PathVariable String id, @PathVariable String expenseId) {
        boolean deleted = tripService.deleteExpense(id, expenseId);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Expense deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    // Voting

    /**
     * Voto dell'utente autenticato (il principal JWT è l'email; un eventuale {@code userId} nel
     * corpo viene ignorato). Solo per i membri del gruppo del viaggio (403) e solo sulle
     * proposte (409). Corpo facoltativo {@code {"voted": true|false}}: senza, il voto si inverte.
     * Risponde con il viaggio aggiornato: {@code decision} diventa "confirmed" quando la
     * maggioranza dei membri attuali ha votato.
     */
    @PostMapping("/{id}/vote")
    public ResponseEntity<?> vote(@PathVariable String id,
                                  @RequestBody(required = false) Map<String, Object> body,
                                  Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<Trip> trip = tripService.getTrip(id);
        if (trip.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Optional<Group> group = groupAccess.memberGroup(trip.get().getGroupId(), auth);
        if (group.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Forbidden", "message", "Solo i membri del gruppo possono votare"));
        }

        Object votedParam = body != null ? body.get("voted") : null;
        Boolean voted = votedParam instanceof Boolean b ? b : null;
        Set<String> memberIds = group.get().getMembers().stream().map(GroupMember::getId).collect(Collectors.toSet());

        TripService.VoteResult result = tripService.vote(id, me.get().getId(), memberIds, voted);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(result.trip());
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            case NOT_PROPOSAL -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Conflict", "message", "Si può votare solo una proposta"));
        };
    }
}
