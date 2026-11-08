package com.example.tripplanner.controller;

import com.example.tripplanner.service.TripReminderService;
import com.example.tripplanner.util.AppDates;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Solo per i test e2e: esiste unicamente con {@code push.reminders.test-endpoint=true}
 * (PUSH_REMINDERS_TEST_ENDPOINT nel docker-compose.e2e.yml), mai in test/produzione.
 * Esegue subito il job dei promemoria come se oggi fosse `date` (yyyy-MM-dd, default oggi in Italia).
 * Sotto /api/v1: serve un utente ADMIN.
 */
@RestController
@RequestMapping("/api/v1/test/trip-reminders")
@ConditionalOnProperty(name = "push.reminders.test-endpoint", havingValue = "true")
public class TripReminderTestController {

    private final TripReminderService reminderService;

    public TripReminderTestController(TripReminderService reminderService) {
        this.reminderService = reminderService;
    }

    /** Risposta: promemoria registrati per tipo, es. {"three_days": 2, "day_before": 0}. */
    @PostMapping("/run")
    public ResponseEntity<?> run(@RequestParam(required = false) String date, Authentication auth) {
        if (!isAdmin(auth)) return ResponseEntity.status(403).build();
        LocalDate today;
        try {
            today = date == null || date.isBlank() ? AppDates.today() : LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Data non valida (yyyy-MM-dd)."));
        }
        return ResponseEntity.ok(reminderService.run(today));
    }

    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().endsWith("ADMIN"));
    }
}
