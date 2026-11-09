package com.example.tripplanner.controller;

import com.example.tripplanner.dto.UpdateProfileDto;
import com.example.tripplanner.dto.UserResponse;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.UserRepository;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    public UserController(UserRepository userRepository, GroupAccess groupAccess, UserService userService) {
        this.userRepository = userRepository;
        this.groupAccess = groupAccess;
        this.userService = userService;
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
