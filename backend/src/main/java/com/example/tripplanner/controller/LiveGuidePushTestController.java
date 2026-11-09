package com.example.tripplanner.controller;

import com.example.tripplanner.service.LiveGuidePushService;
import com.example.tripplanner.util.AppDates;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Solo per i test e2e: esiste unicamente con {@code push.live-guide.test-endpoint=true}
 * (PUSH_LIVE_GUIDE_TEST_ENDPOINT nel docker-compose.e2e.yml), mai in test/produzione.
 * Esegue subito il job delle notifiche della guida come se fosse `at` (ora italiana yyyy-MM-ddTHH:mm, default adesso).
 * Sotto /api/v1: serve un utente ADMIN.
 */
@RestController
@RequestMapping("/api/v1/test/live-guide")
@ConditionalOnProperty(name = "push.live-guide.test-endpoint", havingValue = "true")
public class LiveGuidePushTestController {

    private final LiveGuidePushService liveGuidePushService;

    public LiveGuidePushTestController(LiveGuidePushService liveGuidePushService) {
        this.liveGuidePushService = liveGuidePushService;
    }

    /** Risposta: notifiche registrate per tipo, es. {"morning": 3, "meal": 0, "closing": 0, "evening": 0}. */
    @PostMapping("/run")
    public ResponseEntity<?> run(@RequestParam(required = false) String at, Authentication auth) {
        if (!isAdmin(auth)) return ResponseEntity.status(403).build();
        LocalDateTime now;
        try {
            now = at == null || at.isBlank() ? LocalDateTime.now(AppDates.ZONE) : LocalDateTime.parse(at);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Data e ora non valide (yyyy-MM-ddTHH:mm)."));
        }
        return ResponseEntity.ok(liveGuidePushService.run(now));
    }

    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().endsWith("ADMIN"));
    }
}
