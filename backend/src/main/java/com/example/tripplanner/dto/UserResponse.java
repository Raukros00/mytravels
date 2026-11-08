package com.example.tripplanner.dto;

import com.example.tripplanner.model.User;

import java.time.LocalDate;

/**
 * Dati dell'utente restituiti dalle API di autenticazione.
 * Non contiene la password (né il suo hash): l'entità {@link User} non va mai serializzata direttamente.
 */
public record UserResponse(
        String id,
        String name,
        String firstName,
        String lastName,
        LocalDate birthDate,
        String profileImage,
        String email,
        String avatar,
        String color,
        String role,
        String joinedDate
) {
    public static UserResponse from(User u) {
        return new UserResponse(
                u.getId(), u.getName(), u.getFirstName(), u.getLastName(), u.getBirthDate(),
                u.getProfileImage(), u.getEmail(), u.getAvatar(), u.getColor(), u.getRole(), u.getJoinedDate());
    }
}
