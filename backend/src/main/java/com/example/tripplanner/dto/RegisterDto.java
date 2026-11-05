package com.example.tripplanner.dto;

import com.example.tripplanner.validation.MinAge;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RegisterDto {
    /** Età minima per registrarsi: in Italia, a 14 anni si presta da soli il consenso al trattamento dei dati. */
    public static final int MIN_AGE = 14;

    @NotBlank
    @Size(max = 100)
    private String firstName;

    @NotBlank
    @Size(max = 100)
    private String lastName;

    @NotNull
    @Past
    @MinAge(MIN_AGE)
    private LocalDate birthDate;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6, max = 128)
    private String password;

    private String avatar;
    private String color;

    /**
     * Foto profilo opzionale, già ritagliata dal client: data URL JPEG/PNG/WebP.
     * Limite ~300 KB (il client invia un JPEG 320×320, tipicamente 20-40 KB).
     */
    @Size(max = 400_000)
    @Pattern(regexp = "^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$", message = "formato immagine non valido")
    private String profileImage;
}
