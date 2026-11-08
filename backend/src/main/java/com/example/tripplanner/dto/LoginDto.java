package com.example.tripplanner.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginDto(
        @NotBlank @Email String email,
        @NotBlank String password
) {
    /**
     * Spazi iniziali/finali tolti prima della validazione. Le maiuscole restano: il confronto senza
     * distinzione lo fa {@code AuthService.findByEmail}, che prima cerca l'email esatta (account in
     * conflitto lasciati invariati dalla migrazione V8) e poi la forma in minuscolo.
     */
    public LoginDto {
        email = email == null ? null : email.trim();
    }
}
