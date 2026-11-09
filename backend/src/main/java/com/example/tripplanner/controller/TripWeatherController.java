package com.example.tripplanner.controller;

import com.example.tripplanner.model.GeoPoint;
import com.example.tripplanner.model.Trip;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.TripService;
import com.example.tripplanner.service.WeatherService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Meteo di una giornata del viaggio per la guida "In viaggio" (#111). Solo per i membri del gruppo (404 per gli
 * altri, come le altre risorse del viaggio). Coordinate: quelle della destinazione; se mancano (destinazione a
 * testo libero) quelle della prima tappa del giorno, poi di una tappa qualsiasi o dell'alloggio.
 * Senza coordinate o senza previsioni risponde 200 con {@code available: false}: la guida resta senza meteo.
 */
@RestController
@RequestMapping("/api/v1/trips")
public class TripWeatherController {

    private final TripService tripService;
    private final GroupAccess groupAccess;
    private final WeatherService weatherService;

    public TripWeatherController(TripService tripService, GroupAccess groupAccess, WeatherService weatherService) {
        this.tripService = tripService;
        this.groupAccess = groupAccess;
        this.weatherService = weatherService;
    }

    /** {@code date} = {@code yyyy-MM-dd}, compresa tra l'inizio e la fine del viaggio (400 altrimenti). */
    @GetMapping("/{id}/weather")
    public ResponseEntity<WeatherService.Forecast> weather(@PathVariable String id, @RequestParam String date,
                                                           Authentication auth) {
        Optional<Trip> trip = tripService.getTrip(id)
                .filter(t -> groupAccess.memberGroup(t.getGroupId(), auth).isPresent());
        if (trip.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().build();
        }
        Trip t = trip.get();
        if (!withinTrip(t, date)) return ResponseEntity.badRequest().build();

        Optional<GeoPoint> where = coordinates(t, dayNumber(t, day));
        if (where.isEmpty()) return ResponseEntity.ok(WeatherService.Forecast.unavailable(date));
        return ResponseEntity.ok(weatherService.forecast(where.get().getLat(), where.get().getLng(), day));
    }

    private static boolean withinTrip(Trip t, String date) {
        return t.getStartDate() != null && t.getEndDate() != null
                && date.compareTo(t.getStartDate()) >= 0 && date.compareTo(t.getEndDate()) <= 0;
    }

    private static int dayNumber(Trip t, LocalDate day) {
        try {
            return (int) (day.toEpochDay() - LocalDate.parse(t.getStartDate()).toEpochDay()) + 1;
        } catch (DateTimeParseException e) {
            return 0;
        }
    }

    private static Optional<GeoPoint> coordinates(Trip t, int dayNumber) {
        if (t.getDestinationLat() != null && t.getDestinationLng() != null) {
            return Optional.of(new GeoPoint(t.getDestinationLat(), t.getDestinationLng()));
        }
        Stream<GeoPoint> today = Stream.concat(
                t.getActivities().stream().filter(a -> Objects.equals(a.getAssignedDay(), dayNumber)).map(a -> a.getCoordinates()),
                t.getPlacesToEat().stream().filter(p -> Objects.equals(p.getAssignedDay(), dayNumber)).map(p -> p.getCoordinates()));
        Stream<GeoPoint> any = Stream.concat(
                Stream.concat(t.getActivities().stream().map(a -> a.getCoordinates()),
                        t.getPlacesToEat().stream().map(p -> p.getCoordinates())),
                Stream.of(t.getAccommodation() != null ? t.getAccommodation().getCoordinates() : null));
        return Stream.concat(today, any)
                .filter(p -> p != null && p.getLat() != null && p.getLng() != null)
                .findFirst();
    }
}
