package com.example.tripplanner.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Limiti ai tentativi su accesso, registrazione e anteprima dei codici invito (#65, #83).
 * Valori da {@code app.rate-limit.*} (variabili d'ambiente {@code RATE_LIMIT_*}), con default sicuri.
 */
@Component
public class RateLimits {

    /** Login falliti per email (normalizzata). */
    public final AttemptLimiter loginByEmail;
    /** Login falliti per IP. */
    public final AttemptLimiter loginByIp;
    /** Registrazioni per IP. */
    public final AttemptLimiter registerByIp;
    /** Anteprime di codici invito per IP (contro la ricerca a tappeto dei codici). */
    public final AttemptLimiter invitePreviewByIp;

    private final int loginMax, registerMax, inviteMax;
    private final Duration loginWindow, registerWindow, inviteWindow;

    public RateLimits(
            @Value("${app.rate-limit.login.max-attempts:5}") int loginMax,
            @Value("${app.rate-limit.login.window:15m}") Duration loginWindow,
            @Value("${app.rate-limit.register.max-attempts:5}") int registerMax,
            @Value("${app.rate-limit.register.window:1h}") Duration registerWindow,
            @Value("${app.rate-limit.invite-preview.max-attempts:30}") int inviteMax,
            @Value("${app.rate-limit.invite-preview.window:1m}") Duration inviteWindow) {
        this.loginMax = loginMax;
        this.loginWindow = loginWindow;
        this.registerMax = registerMax;
        this.registerWindow = registerWindow;
        this.inviteMax = inviteMax;
        this.inviteWindow = inviteWindow;
        Clock clock = Clock.systemUTC();
        loginByEmail = new AttemptLimiter(loginMax, loginWindow, clock);
        loginByIp = new AttemptLimiter(loginMax, loginWindow, clock);
        registerByIp = new AttemptLimiter(registerMax, registerWindow, clock);
        invitePreviewByIp = new AttemptLimiter(inviteMax, inviteWindow, clock);
    }

    /** Cambia i limiti di un gruppo ("login", "register", "invitePreview"): usato solo dai test e2e. */
    public void configure(String group, int max, Duration window) {
        switch (group) {
            case "login" -> {
                loginByEmail.configure(max, window);
                loginByIp.configure(max, window);
            }
            case "register" -> registerByIp.configure(max, window);
            case "invitePreview" -> invitePreviewByIp.configure(max, window);
            default -> throw new IllegalArgumentException("Limite sconosciuto: " + group);
        }
    }

    /** Ripristina i limiti configurati e azzera tutti i conteggi: usato solo dai test e2e. */
    public void resetAll() {
        configure("login", loginMax, loginWindow);
        configure("register", registerMax, registerWindow);
        configure("invitePreview", inviteMax, inviteWindow);
        List.of(loginByEmail, loginByIp, registerByIp, invitePreviewByIp).forEach(AttemptLimiter::resetAll);
    }

    /**
     * IP del client: il primo indirizzo di {@code X-Forwarded-For} (il backend è dietro nginx), altrimenti
     * l'indirizzo della connessione.
     */
    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) return first;
        }
        return request.getRemoteAddr();
    }

    /** Risposta 429 con {@code Retry-After} (secondi) e il tempo di attesa anche nel corpo. */
    public static ResponseEntity<Map<String, Object>> tooManyRequests(long retryAfterSeconds) {
        long minutes = Math.max(1, (retryAfterSeconds + 59) / 60);
        String message = "Troppi tentativi, riprova tra " + minutes + (minutes == 1 ? " minuto." : " minuti.");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds))
                .body(Map.of("message", message, "retryAfterSeconds", retryAfterSeconds));
    }
}
