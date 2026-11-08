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
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Viaggi e loro sotto-risorse. Accesso solo ai membri del gruppo del viaggio: per gli altri il
 * viaggio "non esiste" (404, come per i gruppi). Leggono e modificano tutti i membri; il viaggio
 * lo eliminano solo gli admin del gruppo (403 per gli altri membri).
 */
@RestController
@RequestMapping("/api/v1/trips")
public class TripController {

    private final TripService tripService;
    private final GroupAccess groupAccess;

    public TripController(TripService tripService, GroupAccess groupAccess) {
        this.tripService = tripService;
        this.groupAccess = groupAccess;
    }

    /** Solo nei gruppi di cui si è membri (404 altrimenti). L'autore della proposta è chi la crea. */
    @PostMapping
    public ResponseEntity<Trip> createTrip(@Valid @RequestBody CreateTripRequest request, Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (groupAccess.memberGroup(request.getGroupId(), auth).isEmpty()) return notFound();
        Trip created = tripService.createTrip(request, me.get().getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** I viaggi di tutti i gruppi di cui l'utente è membro. */
    @GetMapping
    public ResponseEntity<List<Trip>> getMyTrips(Authentication auth) {
        List<String> groupIds = groupAccess.myGroups(auth).stream().map(Group::getId).toList();
        return ResponseEntity.ok(tripService.getTripsByGroupIds(groupIds));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Trip> getTripById(@PathVariable String id, Authentication auth) {
        return memberTrip(id, auth).map(ResponseEntity::ok).orElseGet(TripController::notFound);
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<List<Trip>> getTripsByGroup(@PathVariable String groupId, Authentication auth) {
        if (groupAccess.memberGroup(groupId, auth).isEmpty()) return notFound();
        return ResponseEntity.ok(tripService.getTripsByGroupId(groupId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable String id, @RequestBody UpdateTripRequest request,
                                           Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateTrip(id, request)));
    }

    /** Solo gli admin del gruppo; gli altri membri ricevono 403. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTrip(@PathVariable String id, Authentication auth) {
        Optional<Trip> trip = memberTrip(id, auth);
        if (trip.isEmpty()) return notFound();
        if (groupAccess.adminGroup(trip.get().getGroupId(), auth).isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Forbidden",
                    "message", "Solo gli amministratori del gruppo possono eliminare il viaggio"));
        }
        if (tripService.deleteTrip(id)) {
            return ResponseEntity.ok(Map.of("message", "Trip deleted successfully"));
        }
        return notFound();
    }

    // Sub-resources: Activities
    @PostMapping("/{id}/activities")
    public ResponseEntity<TripActivity> addActivity(@PathVariable String id, @RequestBody TripActivity activity,
                                                    Authentication auth) {
        return ifMember(id, auth, () -> created(tripService.addActivity(id, activity)));
    }

    @PutMapping("/{id}/activities/{activityId}")
    public ResponseEntity<TripActivity> updateActivity(@PathVariable String id,
                                                       @PathVariable String activityId,
                                                       @RequestBody TripActivity activity,
                                                       Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateActivity(id, activityId, activity)));
    }

    @DeleteMapping("/{id}/activities/{activityId}")
    public ResponseEntity<?> deleteActivity(@PathVariable String id, @PathVariable String activityId,
                                            Authentication auth) {
        return ifMember(id, auth, () -> deleted(tripService.deleteActivity(id, activityId), "Activity deleted successfully"));
    }

    // Sub-resources: Places to Eat
    @PostMapping("/{id}/places-to-eat")
    public ResponseEntity<TripPlaceToEat> addPlaceToEat(@PathVariable String id, @RequestBody TripPlaceToEat place,
                                                        Authentication auth) {
        return ifMember(id, auth, () -> created(tripService.addPlaceToEat(id, place)));
    }

    @PutMapping("/{id}/places-to-eat/{placeId}")
    public ResponseEntity<TripPlaceToEat> updatePlaceToEat(@PathVariable String id,
                                                           @PathVariable String placeId,
                                                           @RequestBody TripPlaceToEat place,
                                                           Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updatePlaceToEat(id, placeId, place)));
    }

    @DeleteMapping("/{id}/places-to-eat/{placeId}")
    public ResponseEntity<?> deletePlaceToEat(@PathVariable String id, @PathVariable String placeId,
                                              Authentication auth) {
        return ifMember(id, auth, () -> deleted(tripService.deletePlaceToEat(id, placeId), "Place to eat deleted successfully"));
    }

    // Sub-resources: Flights, Transfers, Accommodation
    @PutMapping("/{id}/flights")
    public ResponseEntity<Trip> updateFlights(@PathVariable String id, @RequestBody FlightDetails flights,
                                              Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateFlights(id, flights)));
    }

    @PutMapping("/{id}/transfers")
    public ResponseEntity<Trip> updateTransfers(@PathVariable String id, @RequestBody AirportTransfer transfers,
                                                Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateTransfers(id, transfers)));
    }

    @PutMapping("/{id}/accommodation")
    public ResponseEntity<Trip> updateAccommodation(@PathVariable String id, @RequestBody AccommodationDetails accommodation,
                                                    Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateAccommodation(id, accommodation)));
    }

    // Sub-resources: Expenses
    @GetMapping("/{id}/expenses")
    public ResponseEntity<List<TripExpense>> getExpenses(@PathVariable String id, Authentication auth) {
        return ifMember(id, auth, () -> ResponseEntity.ok(tripService.getExpensesByTrip(id)));
    }

    @PostMapping("/{id}/expenses")
    public ResponseEntity<TripExpense> addExpense(@PathVariable String id, @RequestBody TripExpense expense,
                                                  Authentication auth) {
        return ifMember(id, auth, () -> created(tripService.addExpense(id, expense)));
    }

    @PutMapping("/{id}/expenses/{expenseId}")
    public ResponseEntity<TripExpense> updateExpense(@PathVariable String id,
                                                     @PathVariable String expenseId,
                                                     @RequestBody TripExpense expense,
                                                     Authentication auth) {
        return ifMember(id, auth, () -> orNotFound(tripService.updateExpense(id, expenseId, expense)));
    }

    @DeleteMapping("/{id}/expenses/{expenseId}")
    public ResponseEntity<?> deleteExpense(@PathVariable String id, @PathVariable String expenseId,
                                           Authentication auth) {
        return ifMember(id, auth, () -> deleted(tripService.deleteExpense(id, expenseId), "Expense deleted successfully"));
    }

    // Voting

    /**
     * Voto dell'utente autenticato (il principal JWT è l'email; un eventuale {@code userId} nel
     * corpo viene ignorato). Solo per i membri del gruppo del viaggio (404 per gli altri) e solo
     * sulle proposte (409). Corpo facoltativo {@code {"voted": true|false}}: senza, il voto si
     * inverte. Risponde con il viaggio aggiornato: {@code decision} diventa "confirmed" quando la
     * maggioranza dei membri attuali ha votato.
     */
    @PostMapping("/{id}/vote")
    public ResponseEntity<?> vote(@PathVariable String id,
                                  @RequestBody(required = false) Map<String, Object> body,
                                  Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<Group> group = tripService.getTrip(id)
                .flatMap(trip -> groupAccess.memberGroup(trip.getGroupId(), auth));
        if (group.isEmpty()) return notFound();

        Object votedParam = body != null ? body.get("voted") : null;
        Boolean voted = votedParam instanceof Boolean b ? b : null;
        Set<String> memberIds = group.get().getMembers().stream().map(GroupMember::getId).collect(Collectors.toSet());

        TripService.VoteResult result = tripService.vote(id, me.get().getId(), memberIds, voted);
        return switch (result.outcome()) {
            case OK -> ResponseEntity.ok(result.trip());
            case NOT_FOUND -> notFound();
            case NOT_PROPOSAL -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Conflict", "message", "Si può votare solo una proposta"));
        };
    }

    // ── Autorizzazione ────────────────────────────────────────────────────────

    /** Il viaggio, solo se l'utente autenticato è membro del suo gruppo. */
    private Optional<Trip> memberTrip(String id, Authentication auth) {
        return tripService.getTrip(id).filter(t -> groupAccess.memberGroup(t.getGroupId(), auth).isPresent());
    }

    /** Esegue {@code action} solo per i membri del gruppo del viaggio; per gli altri 404. */
    private <T> ResponseEntity<T> ifMember(String tripId, Authentication auth, Supplier<ResponseEntity<T>> action) {
        return memberTrip(tripId, auth).isPresent() ? action.get() : notFound();
    }

    private static <T> ResponseEntity<T> notFound() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    private static <T> ResponseEntity<T> orNotFound(Optional<T> value) {
        return value.map(ResponseEntity::ok).orElseGet(TripController::notFound);
    }

    private static <T> ResponseEntity<T> created(Optional<T> value) {
        return value.map(v -> ResponseEntity.status(HttpStatus.CREATED).body(v)).orElseGet(TripController::notFound);
    }

    private static ResponseEntity<Object> deleted(boolean done, String message) {
        return done ? ResponseEntity.ok(Map.of("message", message)) : notFound();
    }
}
