package com.example.tripplanner.ratelimit;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

/**
 * Solo per i test e2e: esiste unicamente con {@code app.rate-limit.test-endpoint=true}
 * (docker-compose.e2e.yml), mai in test/produzione. Permette a uno spec di abbassare i limiti e poi di
 * ripristinarli, così il resto della suite gira con limiti alti. Sotto /api/v1: serve un utente ADMIN.
 */
@RestController
@RequestMapping("/api/v1/test/rate-limits")
@ConditionalOnProperty(name = "app.rate-limit.test-endpoint", havingValue = "true")
public class RateLimitTestController {

    private final RateLimits rateLimits;

    public RateLimitTestController(RateLimits rateLimits) {
        this.rateLimits = rateLimits;
    }

    /** Body: {"login": {"maxAttempts": 3, "windowSeconds": 600}, ...}. Azzera anche i conteggi. */
    @PutMapping
    public ResponseEntity<Void> configure(@RequestBody Map<String, Map<String, Integer>> limits,
                                          org.springframework.security.core.Authentication auth) {
        if (!isAdmin(auth)) return ResponseEntity.status(403).build();
        rateLimits.resetAll();
        limits.forEach((group, cfg) ->
                rateLimits.configure(group, cfg.get("maxAttempts"), Duration.ofSeconds(cfg.get("windowSeconds"))));
        return ResponseEntity.noContent().build();
    }

    /** Ripristina i limiti configurati e azzera i conteggi. */
    @DeleteMapping
    public ResponseEntity<Void> reset(org.springframework.security.core.Authentication auth) {
        if (!isAdmin(auth)) return ResponseEntity.status(403).build();
        rateLimits.resetAll();
        return ResponseEntity.noContent().build();
    }

    private static boolean isAdmin(org.springframework.security.core.Authentication auth) {
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().endsWith("ADMIN"));
    }
}
