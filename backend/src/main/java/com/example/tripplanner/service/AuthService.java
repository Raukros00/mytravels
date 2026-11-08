package com.example.tripplanner.service;

import com.example.tripplanner.util.AppDates;
import com.example.tripplanner.util.Emails;
import com.example.tripplanner.dto.RegisterDto;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User authenticate(String email, String rawPassword) {
        Optional<User> opt = findByEmail(email);
        if (opt.isPresent() && passwordEncoder.matches(rawPassword, opt.get().getPassword())) {
            return opt.get();
        }
        return null;
    }

    @Transactional
    public User register(RegisterDto dto) {
        String email = Emails.normalize(dto.getEmail());
        if (userRepository.existsByEmailIgnoringCase(email)) {
            throw new IllegalArgumentException("Email already exists: " + email);
        }
        User user = User.builder()
                .id(UUID.randomUUID().toString())
                .name(dto.getFirstName().trim() + " " + dto.getLastName().trim())
                .firstName(dto.getFirstName().trim())
                .lastName(dto.getLastName().trim())
                .birthDate(dto.getBirthDate())
                .profileImage(dto.getProfileImage() == null || dto.getProfileImage().isBlank() ? null : dto.getProfileImage())
                .email(email)
                .password(passwordEncoder.encode(dto.getPassword()))
                .avatar(dto.getAvatar() != null ? dto.getAvatar() : "🚀")
                .color(dto.getColor() != null ? dto.getColor() : "#6366f1")
                .role("USER")
                .joinedDate(AppDates.todayIso())
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public User createDemoUser(String rawEmail, String rawPassword, String name) {
        String email = Emails.normalize(rawEmail);
        return findByEmail(email).orElseGet(() -> {
            User user = User.builder()
                    .id(UUID.randomUUID().toString())
                    .name(name)
                    .firstName(name)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .avatar("👑")
                    .color("#4f46e5")
                    .role("ADMIN")
                    .joinedDate(AppDates.todayIso())
                    .build();
            return userRepository.save(user);
        });
    }

    /**
     * Utente per email, senza distinzione tra maiuscole/minuscole e spazi.
     * Prima si cerca l'email esatta (senza spazi), poi la forma canonica in minuscolo con cui sono
     * salvate le email (registrazione e migrazione V8). L'ordine conta per gli account lasciati invariati
     * dalla V8 perché in conflitto tra loro (es. "Mario@x.it" e "mario@x.it"): il principal del JWT è
     * l'email esatta salvata, quindi ogni token resta legato al proprio account.
     */
    public Optional<User> findByEmail(String email) {
        if (email == null) return Optional.empty();
        String trimmed = email.trim();
        Optional<User> exact = userRepository.findByEmail(trimmed);
        if (exact.isPresent()) return exact;
        String canonical = Emails.normalize(trimmed);
        return canonical.equals(trimmed) ? Optional.empty() : userRepository.findByEmail(canonical);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }
}
