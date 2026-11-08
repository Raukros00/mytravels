package com.example.tripplanner.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Requisiti di una nuova password (#70) sul DTO che contiene {@code email} e {@code password}:
 * non tra le più comuni, diversa dall'email e dalla sua parte prima della {@code @}.
 * La lunghezza minima è controllata a parte con {@code @Size}. Le password esistenti non sono toccate.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = NewPasswordValidator.class)
public @interface NewPassword {
    String message() default "password non valida";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
