package com.example.tripplanner.util;

import java.util.Locale;

/** Email confrontate senza distinzione tra maiuscole/minuscole e senza spazi iniziali/finali (#66). */
public final class Emails {

    private Emails() {
    }

    /** Forma canonica usata per salvare e cercare le email: {@code trim()} + minuscolo. */
    public static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
