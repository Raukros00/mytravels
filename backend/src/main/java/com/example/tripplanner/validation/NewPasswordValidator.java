package com.example.tripplanner.validation;

import com.example.tripplanner.dto.RegisterDto;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public class NewPasswordValidator implements ConstraintValidator<NewPassword, RegisterDto> {

    public static final String TOO_COMMON = "La password è tra le più comuni: scegline una meno prevedibile.";
    public static final String SAME_AS_EMAIL = "La password non può essere uguale all'email.";

    /** Lista breve delle password più comuni (resources/common-passwords.txt), in minuscolo. */
    private static final Set<String> COMMON = load();

    private static Set<String> load() {
        try (InputStream in = NewPasswordValidator.class.getResourceAsStream("/common-passwords.txt")) {
            if (in == null) throw new IllegalStateException("common-passwords.txt mancante");
            return new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8)).lines()
                    .map(String::trim)
                    .filter(l -> !l.isEmpty() && !l.startsWith("#"))
                    .map(l -> l.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static boolean isCommon(String password) {
        return password != null && COMMON.contains(password.trim().toLowerCase(Locale.ROOT));
    }

    public static boolean matchesEmail(String password, String email) {
        if (password == null || email == null || email.isBlank()) return false;
        String p = password.trim().toLowerCase(Locale.ROOT);
        String e = email.trim().toLowerCase(Locale.ROOT);
        int at = e.indexOf('@');
        String local = at > 0 ? e.substring(0, at) : e;
        return p.equals(e) || p.equals(local);
    }

    @Override
    public boolean isValid(RegisterDto dto, ConstraintValidatorContext context) {
        if (dto == null || dto.getPassword() == null) return true; // @NotBlank se ne occupa
        String message = isCommon(dto.getPassword()) ? TOO_COMMON
                : matchesEmail(dto.getPassword(), dto.getEmail()) ? SAME_AS_EMAIL
                : null;
        if (message == null) return true;
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(message).addPropertyNode("password").addConstraintViolation();
        return false;
    }
}
