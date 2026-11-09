package com.example.tripplanner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Conferma dell'eliminazione dell'account (#121): la password attuale dell'utente. */
public record DeleteAccountDto(@NotBlank @Size(max = 128) String password) {}
