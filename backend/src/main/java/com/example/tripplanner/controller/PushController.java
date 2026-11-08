package com.example.tripplanner.controller;

import com.example.tripplanner.model.PushSubscription;
import com.example.tripplanner.model.User;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.PushService;
import com.example.tripplanner.service.PushService.PushMessage;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Notifiche push (Web Push) dell'utente autenticato: chiave pubblica VAPID e abbonamenti dei suoi dispositivi.
 * Ogni operazione riguarda solo l'utente corrente.
 */
@RestController
@RequestMapping("/api/v1/push")
public class PushController {

    private final PushService pushService;
    private final GroupAccess groupAccess;

    public PushController(PushService pushService, GroupAccess groupAccess) {
        this.pushService = pushService;
        this.groupAccess = groupAccess;
    }

    /** Chiave pubblica da usare per PushManager.subscribe; `enabled: false` se le push sono disattivate sul server. */
    @GetMapping("/public-key")
    public ResponseEntity<Map<String, Object>> publicKey() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", pushService.isEnabled());
        body.put("publicKey", pushService.publicKey());
        return ResponseEntity.ok(body);
    }

    /** Dispositivi abbonati dell'utente corrente (senza le chiavi). */
    @GetMapping("/subscriptions")
    public ResponseEntity<List<Map<String, Object>>> list(Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(pushService.subscriptionsOf(me.get().getId()).stream().map(PushController::view).toList());
    }

    /**
     * Salva o aggiorna l'abbonamento del dispositivo. Corpo: il JSON di PushSubscription del browser
     * (`{ endpoint, keys: { p256dh, auth } }`) più `lang` facoltativo ('it' | 'en').
     */
    @PostMapping("/subscriptions")
    public ResponseEntity<?> subscribe(@RequestBody Map<String, Object> body,
                                       @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
                                       Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!pushService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Le notifiche push non sono attive sul server."));
        }
        String endpoint = string(body.get("endpoint"));
        Map<?, ?> keys = body.get("keys") instanceof Map<?, ?> k ? k : Map.of();
        String p256dh = string(keys.get("p256dh"));
        String authSecret = string(keys.get("auth"));
        String error = pushService.validate(endpoint, p256dh, authSecret);
        if (error != null) return ResponseEntity.badRequest().body(Map.of("message", error));
        String lang = string(body.get("lang"));
        lang = lang == null ? null : lang.trim().toLowerCase().replaceAll("[^a-z-]", "");
        if (lang != null && (lang.isEmpty() || lang.length() > 10)) lang = null;
        PushSubscription saved = pushService.subscribe(me.get().getId(), endpoint.trim(), p256dh.trim(), authSecret.trim(), userAgent, lang);
        return ResponseEntity.ok(view(saved));
    }

    /** Rimuove l'abbonamento del dispositivo (endpoint nel corpo o come parametro). Idempotente. */
    @DeleteMapping("/subscriptions")
    public ResponseEntity<Void> unsubscribe(@RequestBody(required = false) Map<String, Object> body,
                                            @RequestParam(required = false) String endpoint,
                                            Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String target = endpoint != null ? endpoint : body == null ? null : string(body.get("endpoint"));
        if (target == null || target.isBlank()) return ResponseEntity.badRequest().build();
        pushService.unsubscribe(me.get().getId(), target.trim());
        return ResponseEntity.noContent().build();
    }

    /** Notifica di prova a tutti i dispositivi dell'utente corrente (per verificare che arrivino). */
    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> test(Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!pushService.isEnabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Le notifiche push non sono attive sul server."));
        }
        int devices = pushService.subscriptionsOf(me.get().getId()).size();
        pushService.sendToUser(me.get().getId(), lang -> "en".equals(lang)
                ? new PushMessage("WanderBite", "Notifications are on for this device.", "/profile", "test")
                : new PushMessage("WanderBite", "Le notifiche sono attive su questo dispositivo.", "/profile", "test"));
        return ResponseEntity.accepted().body(Map.of("devices", devices));
    }

    private static Map<String, Object> view(PushSubscription s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("endpoint", s.getEndpoint());
        m.put("userAgent", s.getUserAgent());
        m.put("lang", s.getLang());
        m.put("createdAt", s.getCreatedAt() == null ? null : s.getCreatedAt().toString());
        m.put("lastUsedAt", s.getLastUsedAt() == null ? null : s.getLastUsedAt().toString());
        return m;
    }

    private static String string(Object value) {
        return value instanceof String s ? s : null;
    }
}
