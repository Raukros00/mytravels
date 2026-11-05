package com.example.tripplanner.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** La data (di nascita) deve corrispondere ad almeno {@code value} anni compiuti oggi. */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = MinAgeValidator.class)
public @interface MinAge {
    int value();
    String message() default "devi avere almeno {value} anni";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
