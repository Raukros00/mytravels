package com.example.tripplanner.service;

import com.example.tripplanner.dto.RegisterDto;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
        Optional<User> opt = userRepository.findByEmail(email);
        if (opt.isPresent() && passwordEncoder.matches(rawPassword, opt.get().getPassword())) {
            return opt.get();
        }
        return null;
    }

    @Transactional
    public User register(RegisterDto dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + dto.getEmail());
        }
        User user = User.builder()
                .id(UUID.randomUUID().toString())
                .name(dto.getName())
                .email(dto.getEmail())
                .password(passwordEncoder.encode(dto.getPassword()))
                .avatar(dto.getAvatar() != null ? dto.getAvatar() : "🚀")
                .color(dto.getColor() != null ? dto.getColor() : "#6366f1")
                .role("USER")
                .joinedDate(Instant.now().toString().split("T")[0])
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public User createDemoUser(String email, String rawPassword, String name) {
        return userRepository.findByEmail(email).orElseGet(() -> {
            User user = User.builder()
                    .id(UUID.randomUUID().toString())
                    .name(name)
                    .email(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .avatar("👑")
                    .color("#4f46e5")
                    .role("ADMIN")
                    .joinedDate(Instant.now().toString().split("T")[0])
                    .build();
            return userRepository.save(user);
        });
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findById(String id) {
        return userRepository.findById(id);
    }
}
