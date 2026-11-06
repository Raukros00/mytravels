package com.example.tripplanner.validation;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.Objects;

/**
 * Regole sulle date di un viaggio, salvate come testo {@code yyyy-MM-dd}:
 * formato valido (anche il giorno deve esistere, es. niente 31 febbraio) e fine non precedente all'inizio.
 * Le violazioni sono {@link IllegalArgumentException}, che l'API restituisce come 400 con il messaggio.
 */
public final class TripDates {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("uuuu-MM-dd")
            .withResolverStyle(ResolverStyle.STRICT);

    static final String START_LABEL = "inizio";
    static final String END_LABEL = "fine";
    public static final String END_BEFORE_START = "La data di fine non può precedere la data di inizio.";

    private TripDates() {
    }

    /** Date di un nuovo viaggio: se presenti devono essere valide e in ordine. */
    public static void validate(String startDate, String endDate) {
        LocalDate start = parse(startDate, START_LABEL);
        LocalDate end = parse(endDate, END_LABEL);
        checkOrder(start, end);
    }

    /**
     * Date di un viaggio modificato: {@code null} nella richiesta lascia la data attuale.
     * Si controlla solo se una data cambia, così le modifiche ad altro (voti, note...) non vengono
     * bloccate da eventuali date incoerenti salvate prima di questo controllo.
     */
    public static void validateUpdate(String currentStart, String currentEnd, String newStart, String newEnd) {
        boolean startChanged = newStart != null && !Objects.equals(newStart, currentStart);
        boolean endChanged = newEnd != null && !Objects.equals(newEnd, currentEnd);
        if (!startChanged && !endChanged) return;

        LocalDate start = startChanged ? parse(newStart, START_LABEL) : tryParse(currentStart);
        LocalDate end = endChanged ? parse(newEnd, END_LABEL) : tryParse(currentEnd);
        checkOrder(start, end);
    }

    private static void checkOrder(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw new IllegalArgumentException(END_BEFORE_START);
        }
    }

    private static LocalDate parse(String value, String label) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value, ISO_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Data di " + label + " non valida: usa il formato yyyy-MM-dd (es. 2027-06-10).");
        }
    }

    private static LocalDate tryParse(String value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value, ISO_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
