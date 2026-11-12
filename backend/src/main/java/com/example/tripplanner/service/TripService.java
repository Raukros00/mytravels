package com.example.tripplanner.service;

import com.example.tripplanner.util.AppDates;
import com.example.tripplanner.util.TimeSlots;
import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.dto.UpdateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.repository.TripActivityRepository;
import com.example.tripplanner.repository.TripExpenseRepository;
import com.example.tripplanner.repository.TripPlaceToEatRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.validation.TripDates;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.tripplanner.util.CountryCodes;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    /**
     * Crea il viaggio. {@code proposedBy} è l'utente autenticato (solo per le proposte): quello
     * eventualmente inviato dal client viene ignorato, come i voti (si votano con /vote).
     */
    @Transactional
    public Trip createTrip(CreateTripRequest request, String currentUserId) {
        TripDates.validate(request.getStartDate(), request.getEndDate());
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
                .countryCode(CountryCodes.resolve(request.getCountryCode(), request.getCountry()))
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
                .proposedBy("proposal".equals(decision) ? currentUserId : null)
                .votes(new ArrayList<>())
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

    /** I viaggi dei gruppi indicati (i gruppi dell'utente). */
    public List<Trip> getTripsByGroupIds(List<String> groupIds) {
        if (groupIds.isEmpty()) return List.of();
        return tripRepository.findByGroupIdIn(groupIds);
    }

    @Transactional
    public Optional<Trip> updateTrip(String id, UpdateTripRequest request) {
        return tripRepository.findById(id).map(existing -> {
            TripDates.validateUpdate(existing.getStartDate(), existing.getEndDate(),
                    request.getStartDate(), request.getEndDate());
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
            // Il codice della nazione segue destinazione e nazione: dal luogo scelto o, per il testo libero, dal nome.
            if (request.getDestination() != null || request.getCountry() != null || request.getCountryCode() != null) {
                existing.setCountryCode(CountryCodes.resolve(request.getCountryCode(), existing.getCountry()));
            }
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
            // proposedBy non si modifica: è l'autore della proposta, deciso in creazione.
            if (request.getBudgetEstimate() != null) existing.setBudgetEstimate(request.getBudgetEstimate());
            if (request.getCurrency() != null)    existing.setCurrency(request.getCurrency());
            if (request.getNotes() != null)       existing.setNotes(request.getNotes().trim());
            if (request.getFlights() != null)     existing.setFlights(request.getFlights());
            if (request.getTransfers() != null)   existing.setTransfers(request.getTransfers());
            if (request.getAccommodation() != null) existing.setAccommodation(withValidCoordinates(request.getAccommodation()));

            // I voti non si modificano da qui: cambiano solo con POST /trips/{id}/vote (vedi vote()).

            // Replace tags via clear+addAll to avoid reassigning the managed collection
            if (request.getTags() != null) {
                existing.getTags().clear();
                existing.getTags().addAll(request.getTags());
            }

            // Le liste (oggi non inviate dal frontend) sostituiscono quelle del viaggio. Un id che
            // non è già di questo viaggio viene rigenerato: con l'id di un elemento di un altro
            // viaggio il salvataggio lo sposterebbe qui.
            if (request.getActivities() != null) {
                Set<String> own = idsOf(existing.getActivities(), TripActivity::getId);
                existing.getActivities().clear();
                for (TripActivity a : request.getActivities()) {
                    if (a.getId() == null || !own.contains(a.getId())) {
                        a.setId(newId("act"));
                    }
                    normalizeSchedule(a);
                    a.setTripId(existing.getId());
                    a.setTrip(existing);
                    existing.getActivities().add(a);
                }
            }

            // Replace placesToEat via clear+addAll
            if (request.getPlacesToEat() != null) {
                Set<String> own = idsOf(existing.getPlacesToEat(), TripPlaceToEat::getId);
                existing.getPlacesToEat().clear();
                for (TripPlaceToEat p : request.getPlacesToEat()) {
                    if (p.getId() == null || !own.contains(p.getId())) {
                        p.setId(newId("eat"));
                    }
                    normalizeSchedule(p);
                    p.setTripId(existing.getId());
                    p.setTrip(existing);
                    existing.getPlacesToEat().add(p);
                }
            }

            // Replace expenses via clear+addAll
            if (request.getExpenses() != null) {
                Set<String> own = idsOf(existing.getExpenses(), TripExpense::getId);
                existing.getExpenses().clear();
                for (TripExpense e : request.getExpenses()) {
                    if (e.getId() == null || !own.contains(e.getId())) {
                        e.setId(newId("exp"));
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
        normalizeSchedule(activity);
        return tripRepository.findById(tripId).map(trip -> {
            activity.setId(newId("act")); // sempre del server: un id inviato potrebbe essere di un altro viaggio
            activity.setTripId(tripId);
            activity.setTrip(trip);
            trip.getActivities().add(activity);
            tripRepository.save(trip);
            return activity;
        });
    }

    @Transactional
    public Optional<TripActivity> updateActivity(String tripId, String activityId, TripActivity updated) {
        normalizeSchedule(updated);
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
        normalizeSchedule(place);
        return tripRepository.findById(tripId).map(trip -> {
            place.setId(newId("eat")); // sempre del server: un id inviato potrebbe essere di un altro viaggio
            place.setTripId(tripId);
            place.setTrip(trip);
            trip.getPlacesToEat().add(place);
            tripRepository.save(trip);
            return place;
        });
    }

    @Transactional
    public Optional<TripPlaceToEat> updatePlaceToEat(String tripId, String placeId, TripPlaceToEat updated) {
        normalizeSchedule(updated);
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

    // ── Orari e ordine delle tappe nella giornata (#101) ─────────────────────

    /** Orari validati (o ricavati dalla fascia scritta a mano); senza giorno non c'è posizione nella giornata. */
    private static void normalizeSchedule(TripActivity a) {
        TimeSlots.Range r = TimeSlots.normalize(a.getStartTime(), a.getEndTime(), a.getTimeSlot());
        a.setStartTime(r.start());
        a.setEndTime(r.end());
        if (a.getAssignedDay() == null) a.setDayOrder(null);
        if (a.getIsSkipped() == null) a.setIsSkipped(false); // colonna NOT NULL (#103)
        a.setCoordinates(validCoordinates(a.getCoordinates()));
    }

    private static void normalizeSchedule(TripPlaceToEat p) {
        TimeSlots.Range r = TimeSlots.normalize(p.getStartTime(), p.getEndTime(), p.getTimeSlot());
        p.setStartTime(r.start());
        p.setEndTime(r.end());
        if (p.getAssignedDay() == null) p.setDayOrder(null);
        if (p.getIsSkipped() == null) p.setIsSkipped(false); // colonna NOT NULL (#103)
        p.setCoordinates(validCoordinates(p.getCoordinates()));
    }

    /**
     * Coordinate di una tappa o dell'alloggio (#102): entrambe o nessuna, nei limiti della Terra.
     *
     * @return null se assenti
     * @throws IllegalArgumentException coordinate incomplete o fuori scala
     */
    static GeoPoint validCoordinates(GeoPoint point) {
        if (point == null || (point.getLat() == null && point.getLng() == null)) return null;
        if (point.getLat() == null || point.getLng() == null) {
            throw new IllegalArgumentException("coordinates: indicare sia lat sia lng");
        }
        if (!Double.isFinite(point.getLat()) || Math.abs(point.getLat()) > 90
                || !Double.isFinite(point.getLng()) || Math.abs(point.getLng()) > 180) {
            throw new IllegalArgumentException("coordinates: lat tra -90 e 90, lng tra -180 e 180");
        }
        return point;
    }

    private static AccommodationDetails withValidCoordinates(AccommodationDetails accommodation) {
        if (accommodation != null) accommodation.setCoordinates(validCoordinates(accommodation.getCoordinates()));
        return accommodation;
    }

    /** Una tappa della giornata: {@code type} è "activity" o "food". */
    public record DayStopRef(String type, String id) {
    }

    /**
     * Salva in una volta l'ordine delle tappe del giorno {@code day}: la posizione nell'elenco diventa
     * {@code dayOrder}. Tutte le tappe devono essere del viaggio e assegnate a quel giorno.
     * Le tappe del giorno non elencate restano come sono.
     *
     * @return vuoto se il viaggio non esiste
     * @throws IllegalArgumentException tappa sconosciuta, di un altro giorno, ripetuta o di tipo non valido
     */
    @Transactional
    public Optional<Trip> reorderDay(String tripId, int day, List<DayStopRef> stops) {
        Optional<Trip> found = tripRepository.findById(tripId);
        if (found.isEmpty()) return Optional.empty();
        if (stops == null) throw new IllegalArgumentException("items: elenco delle tappe mancante");

        Set<String> seen = new HashSet<>();
        for (int i = 0; i < stops.size(); i++) {
            DayStopRef ref = stops.get(i);
            if (ref == null || ref.id() == null || !seen.add(ref.type() + ":" + ref.id())) {
                throw new IllegalArgumentException("items: tappa mancante o ripetuta");
            }
            final int position = i;
            if ("activity".equals(ref.type())) {
                TripActivity a = activityRepository.findById(ref.id())
                        .filter(x -> tripId.equals(x.getTripId()) && Objects.equals(x.getAssignedDay(), day))
                        .orElseThrow(() -> new IllegalArgumentException("items: attività non presente nel giorno " + day));
                a.setDayOrder(position);
                activityRepository.save(a);
            } else if ("food".equals(ref.type())) {
                TripPlaceToEat p = placeRepository.findById(ref.id())
                        .filter(x -> tripId.equals(x.getTripId()) && Objects.equals(x.getAssignedDay(), day))
                        .orElseThrow(() -> new IllegalArgumentException("items: locale non presente nel giorno " + day));
                p.setDayOrder(position);
                placeRepository.save(p);
            } else {
                throw new IllegalArgumentException("items: tipo di tappa non valido (activity o food)");
            }
        }
        return tripRepository.findById(tripId);
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
        withValidCoordinates(accommodation);
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
            expense.setId(newId("exp")); // sempre del server: un id inviato potrebbe essere di un altro viaggio
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

    /** Id nuovo per un elemento del viaggio (attività, locale, spesa). */
    private static String newId(String prefix) {
        return prefix + "_" + UUID.randomUUID();
    }

    private static <T> Set<String> idsOf(List<T> items, Function<T, String> id) {
        return items.stream().map(id).filter(Objects::nonNull).collect(Collectors.toSet());
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    public enum VoteOutcome { OK, NOT_FOUND, NOT_PROPOSAL }

    /** {@code approved}: è stato questo voto a far raggiungere la maggioranza (proposta appena confermata). */
    public record VoteResult(VoteOutcome outcome, Trip trip, boolean approved) {
        static VoteResult of(VoteOutcome outcome) { return new VoteResult(outcome, null, false); }
    }

    /**
     * Voto dell'utente su una proposta, deciso interamente dal server: la riga del viaggio è
     * bloccata, quindi voti quasi simultanei vengono applicati uno dopo l'altro e contano tutti.
     * {@code voted} indica il voto voluto (idempotente); se nullo il voto viene invertito.
     * Se i voti dei membri attuali ({@code memberIds}) raggiungono la maggioranza stretta del
     * gruppo, la proposta diventa confermata. I voti di chi non è più membro restano ma non contano.
     */
    @Transactional
    public VoteResult vote(String tripId, String userId, Set<String> memberIds, Boolean voted) {
        Optional<Trip> found = tripRepository.findByIdForUpdate(tripId);
        if (found.isEmpty()) return VoteResult.of(VoteOutcome.NOT_FOUND);
        Trip trip = found.get();
        if (!"proposal".equals(trip.getDecision())) return VoteResult.of(VoteOutcome.NOT_PROPOSAL);

        boolean has = trip.getVotes().contains(userId);
        boolean want = voted != null ? voted : !has;
        if (want && !has) trip.getVotes().add(userId);
        if (!want && has) trip.getVotes().removeIf(userId::equals);

        long validVotes = trip.getVotes().stream().distinct().filter(memberIds::contains).count();
        boolean approved = validVotes >= memberIds.size() / 2 + 1;
        if (approved) trip.setDecision("confirmed");

        return new VoteResult(VoteOutcome.OK, tripRepository.save(trip), approved);
    }
}
