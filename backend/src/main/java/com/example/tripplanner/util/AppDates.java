package com.example.tripplanner.util;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Data "di calendario" dell'app, calcolata sul fuso italiano e non su quello del server (UTC nei container):
 * {@code Instant.now().toString().split("T")[0]} tra mezzanotte e l'01:00 (02:00 con l'ora legale) dà ieri.
 */
public final class AppDates {

    public static final ZoneId ZONE = ZoneId.of("Europe/Rome");

    private AppDates() {
    }

    /** Oggi in Italia. */
    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Oggi in Italia, come {@code yyyy-MM-dd}. */
    public static String todayIso() {
        return today().toString();
    }
}
