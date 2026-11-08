package com.example.tripplanner.util;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Orari delle tappe (attività e ristoranti): {@code startTime} / {@code endTime} in formato {@code HH:mm}.
 * Le regole di riconoscimento delle fasce scritte a mano sono le stesse della migrazione V9 e di
 * {@code parseTimeSlot} nel frontend.
 */
public final class TimeSlots {

    private static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final Pattern SLOT = Pattern.compile(
            "^\\s*(\\d{1,2})[:.](\\d{2})\\s*(?:[-–—]\\s*(\\d{1,2})[:.](\\d{2}))?\\s*$");

    private TimeSlots() {
    }

    /** Inizio e fine (la fine può essere nulla). */
    public record Range(String start, String end) {
    }

    public static boolean isValidTime(String value) {
        return value != null && TIME.matcher(value).matches();
    }

    /**
     * Interpreta "10:00 - 12:30", "10.00-12.30", "9:30" (anche con – o —). Una fine non successiva
     * all'inizio viene scartata. Vuoto per testi non riconoscibili (es. "mattina").
     */
    public static Optional<Range> parse(String slot) {
        if (slot == null) return Optional.empty();
        Matcher m = SLOT.matcher(slot);
        if (!m.matches()) return Optional.empty();
        String start = time(m.group(1), m.group(2));
        if (start == null) return Optional.empty();
        String end = null;
        if (m.group(3) != null) {
            end = time(m.group(3), m.group(4));
            if (end == null) return Optional.empty();
            if (end.compareTo(start) <= 0) end = null;
        }
        return Optional.of(new Range(start, end));
    }

    /**
     * Normalizza gli orari di una tappa: vuoti → null; senza orari ma con una fascia riconoscibile
     * (es. da un client che conosce solo {@code timeSlot}) li ricava da questa.
     *
     * @throws IllegalArgumentException orari non validi, fine senza inizio o fine non successiva all'inizio
     */
    public static Range normalize(String startTime, String endTime, String timeSlot) {
        String start = blankToNull(startTime);
        String end = blankToNull(endTime);
        if (start == null && end == null) {
            return parse(timeSlot).orElse(new Range(null, null));
        }
        if (start != null && !isValidTime(start)) {
            throw new IllegalArgumentException("startTime: orario non valido (atteso HH:mm)");
        }
        if (end != null && !isValidTime(end)) {
            throw new IllegalArgumentException("endTime: orario non valido (atteso HH:mm)");
        }
        if (start == null) {
            throw new IllegalArgumentException("endTime: indicare anche l'orario di inizio");
        }
        if (end != null && end.compareTo(start) <= 0) {
            throw new IllegalArgumentException("endTime: deve essere successivo all'inizio");
        }
        return new Range(start, end);
    }

    private static String time(String h, String m) {
        int hours = Integer.parseInt(h);
        int minutes = Integer.parseInt(m);
        if (hours > 23 || minutes > 59) return null;
        return String.format("%02d:%02d", hours, minutes);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
