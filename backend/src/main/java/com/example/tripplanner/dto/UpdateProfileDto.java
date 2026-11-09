package com.example.tripplanner.dto;

import com.example.tripplanner.validation.MinAge;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/**
 * Modifica dei dati personali dal Profilo (#120): stesse regole di {@link RegisterDto}.
 * È una sostituzione completa: {@code profileImage} assente o vuota = nessuna foto (rimossa).
 * Email e password non si cambiano da qui.
 */
@Data
public class UpdateProfileDto {

    @NotBlank
    @Size(max = 100)
    private String firstName;

    @NotBlank
    @Size(max = 100)
    private String lastName;

    @NotNull
    @Past
    @MinAge(RegisterDto.MIN_AGE)
    private LocalDate birthDate;

    /** Emoji dell'avatar (usata quando non c'è la foto). Assente = invariata. */
    @Size(max = 32)
    private String avatar;

    /** Colore di sfondo dell'avatar emoji (#rrggbb). Assente = invariato. */
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "colore non valido")
    private String color;

    /** Foto profilo già ritagliata dal client: stessi limiti della registrazione. */
    @Size(max = 400_000)
    @Pattern(regexp = "^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$", message = "formato immagine non valido")
    private String profileImage;
}
