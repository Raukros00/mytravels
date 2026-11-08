package com.example.tripplanner.controller;

import com.example.tripplanner.dto.LoginDto;
import com.example.tripplanner.dto.RegisterDto;
import com.example.tripplanner.dto.UserResponse;
import com.example.tripplanner.model.User;
import com.example.tripplanner.ratelimit.RateLimits;
import com.example.tripplanner.security.JwtUtil;
import com.example.tripplanner.service.AuthService;
import com.example.tripplanner.util.Emails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final RateLimits rateLimits;

    public AuthController(AuthService authService, JwtUtil jwtUtil, RateLimits rateLimits) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.rateLimits = rateLimits;
    }

    /**
     * Accesso. Dopo troppi tentativi falliti per la stessa email o dallo stesso IP risponde 429
     * (anche con la password giusta) finché la finestra non scade; un accesso riuscito azzera il
     * conteggio dell'email (#65).
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginDto loginDto, HttpServletRequest request) {
        String emailKey = Emails.normalize(loginDto.email());
        String ip = RateLimits.clientIp(request);
        long wait = Math.max(rateLimits.loginByEmail.retryAfterSeconds(emailKey), rateLimits.loginByIp.retryAfterSeconds(ip));
        if (wait > 0) return RateLimits.tooManyRequests(wait);

        User user = authService.authenticate(loginDto.email(), loginDto.password());
        if (user == null) {
            rateLimits.loginByEmail.record(emailKey);
            rateLimits.loginByIp.record(ip);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }
        rateLimits.loginByEmail.reset(emailKey);
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole());
        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", UserResponse.from(user)
        ));
    }

    /** Registrazione: al massimo N richieste per IP nella finestra configurata (#65). */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterDto registerDto, HttpServletRequest request) {
        String ip = RateLimits.clientIp(request);
        long wait = rateLimits.registerByIp.retryAfterSeconds(ip);
        if (wait > 0) return RateLimits.tooManyRequests(wait);
        rateLimits.registerByIp.record(ip);
        try {
            User created = authService.register(registerDto);
            String token = jwtUtil.generateToken(created.getEmail(), created.getRole());
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "token", token,
                    "user", UserResponse.from(created)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
        } catch (DataIntegrityViolationException e) {
            // Due registrazioni simultanee con la stessa email: le blocca il vincolo univoco del database.
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Email already exists"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<User> userOpt = authService.findByEmail(authentication.getName());
        return userOpt.<ResponseEntity<?>>map(u -> ResponseEntity.ok(UserResponse.from(u)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
