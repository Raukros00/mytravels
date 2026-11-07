package com.example.tripplanner.validation;

import com.example.tripplanner.util.AppDates;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.time.LocalDate;

public class MinAgeValidator implements ConstraintValidator<MinAge, LocalDate> {

    private int minAge;

    @Override
    public void initialize(MinAge annotation) {
        this.minAge = annotation.value();
    }

    @Override
    public boolean isValid(LocalDate birthDate, ConstraintValidatorContext context) {
        if (birthDate == null) return true; // l'obbligatorietà la gestisce @NotNull
        return !birthDate.isAfter(AppDates.today().minusYears(minAge));
    }
}
