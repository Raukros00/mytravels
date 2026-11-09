package com.example.tripplanner.controller;

import com.example.tripplanner.dto.DeleteAccountDto;
import com.example.tripplanner.dto.UpdateProfileDto;
import com.example.tripplanner.dto.UserResponse;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.UserRepository;
import com.example.tripplanner.ratelimit.RateLimits;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private static final int MIN_QUERY = 2;
    private static final int MAX_RESULTS = 10;

    private final UserRepository userRepository;
    private final GroupAccess groupAccess;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final RateLimits rateLimits;

    public UserController(UserRepository userRepository, GroupAccess groupAccess, UserService userService,
                          PasswordEncoder passwordEncoder, RateLimits rateLimits) {
        this.userRepository = userRepository;
        this.groupAccess = groupAccess;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.rateLimits = rateLimits;
    }

    /**
     * Eliminazione dell'account dell'utente corrente (#121), confermata con la password.
     * <ul>
     *   <li>password errata: 401 {@code {code: "wrong_password"}} (conta come tentativo di accesso: dopo troppi
     *       tentativi 429, come il login, #65);</li>
     *   <li>unico admin di gruppi con altri membri: 409 {@code {code: "sole_admin", groups: [{id, name}]}};</li>
     *   <li>riuscita: 204. Il token non funziona più (vedi {@code JwtAuthenticationFilter}).</li>
     * </ul>
     */
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteMe(@Valid @RequestBody DeleteAccountDto dto, Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String key = me.get().getEmail();
        long wait = rateLimits.loginByEmail.retryAfterSeconds(key);
        if (wait > 0) return RateLimits.tooManyRequests(wait);
        if (!passwordEncoder.matches(dto.password(), me.get().getPassword())) {
            rateLimits.loginByEmail.record(key);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("code", "wrong_password", "message", "Password non corretta"));
        }
        try {
            userService.deleteAccount(me.get());
        } catch (UserService.DeletionBlockedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("code", "sole_admin", "message", e.getMessage(), "groups", e.getGroups()));
        }
        rateLimits.loginByEmail.reset(key);
        return ResponseEntity.noContent().build();
    }

    /** "Scarica i miei dati" (#121): JSON con i dati personali dell'utente corrente, come file da salvare. */
    @GetMapping("/me/export")
    public ResponseEntity<Map<String, Object>> exportMe(Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"wanderbite-dati.json\"")
                .body(userService.exportData(me.get()));
    }

    /** Modifica dei dati personali dell'utente corrente (#120): nome, cognome, data di nascita, foto, avatar. */
    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateMe(@Valid @RequestBody UpdateProfileDto dto, Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(UserResponse.from(userService.updateProfile(me.get(), dto)));
    }

    /**
     * Ricerca utenti da invitare: per nome (anche parziale) o per email esatta.
     * Restituisce solo dati da profilo pubblico (niente email), al massimo 10 risultati, escluso chi cerca.
     */
    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam(defaultValue = "") String q, Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String query = q.trim();
        if (query.length() < MIN_QUERY) return ResponseEntity.ok(List.of());

        List<Map<String, Object>> results = userRepository.search(query, PageRequest.of(0, MAX_RESULTS + 1)).stream()
                .filter(u -> !u.getId().equals(me.get().getId()))
                .limit(MAX_RESULTS)
                .map(UserController::publicProfile)
                .toList();
        return ResponseEntity.ok(results);
    }

    private static Map<String, Object> publicProfile(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", u.getName());
        m.put("avatar", u.getAvatar());
        m.put("color", u.getColor());
        m.put("profileImage", u.getProfileImage());
        return m;
    }
}
