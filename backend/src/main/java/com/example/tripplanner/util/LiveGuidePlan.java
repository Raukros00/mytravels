package com.example.tripplanner.util;

import com.example.tripplanner.model.Trip;
import com.example.tripplanner.model.TripActivity;
import com.example.tripplanner.model.TripPlaceToEat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Notifiche della guida durante il viaggio (#110), calcolate in modo puro dai dati del viaggio:
 * <ul>
 *   <li><b>buongiorno</b> all'orario di inizio giornata con il programma del giorno;</li>
 *   <li><b>pasti</b> all'orario di inizio del pasto programmato (orario della tappa, altrimenti 12:30 / 20:00);</li>
 *   <li><b>chiusure imminenti</b>: 1 ora prima della chiusura di una tappa non ancora fatta, se gli orari di
 *       apertura sono interpretabili ("9:00-17:00", "9-13, 15-19") e la tappa non è chiusa quel giorno;</li>
 *   <li><b>fine giornata</b> con il riepilogo e l'anteprima di domani.</li>
 * </ul>
 * Stesse regole del frontend (day-schedule.utils.ts, reschedule.utils.ts, live-suggestions.utils.ts).
 */
public final class LiveGuidePlan {

    public enum Kind {
        MORNING("morning"), MEAL("meal"), CLOSING("closing"), EVENING("evening");

        public final String code;

        Kind(String code) {
            this.code = code;
        }
    }

    /** Tappa della giornata, con l'orario effettivo (può mancare). */
    public record Stop(String ref, String name, boolean food, String meal, LocalTime start, Integer order,
                       boolean done, boolean skipped, String openingHours, String closingDays) {}

    /**
     * Un evento da notificare alle `at`. `stop` per pasti e chiusure; `closesAt` per le chiusure;
     * per buongiorno e fine giornata il programma di oggi e di domani.
     */
    public record Event(Kind kind, String ref, LocalTime at, Stop stop, LocalTime closesAt,
                        List<Stop> today, List<Stop> tomorrow, boolean lastDay) {}

    /** Orari indicativi dei pasti senza orario (come MEAL_DEFAULT_TIMES nel frontend). */
    private static final Map<String, LocalTime> MEAL_DEFAULTS = Map.of(
            "lunch", LocalTime.of(12, 30),
            "dinner", LocalTime.of(20, 0));
    private static final Set<String> MEALS = Set.of("breakfast", "lunch", "dinner", "aperitivo", "snack");
    private static final Pattern HOURS = Pattern.compile(
            "(?<![\\d:./-])(\\d{1,2})(?:[:.](\\d{2}))?\\s*[-–—]\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?![\\d/-])");
    private static final Pattern CLOSED_WORD = Pattern.compile("(chius[oaie]|closed)", Pattern.CASE_INSENSITIVE);
    private static final List<Map.Entry<Pattern, DayOfWeek>> WEEKDAYS = List.of(
            weekday("domenica|domeniche|dom|sunday|sundays|sun", DayOfWeek.SUNDAY),
            weekday("luned[iì]|lun|monday|mondays|mon", DayOfWeek.MONDAY),
            weekday("marted[iì]|mar|tuesday|tuesdays|tue|tues", DayOfWeek.TUESDAY),
            weekday("mercoled[iì]|mer|wednesday|wednesdays|wed", DayOfWeek.WEDNESDAY),
            weekday("gioved[iì]|gio|thursday|thursdays|thu|thur|thurs", DayOfWeek.THURSDAY),
            weekday("venerd[iì]|ven|friday|fridays|fri", DayOfWeek.FRIDAY),
            weekday("sabato|sabati|sab|saturday|saturdays|sat", DayOfWeek.SATURDAY));
    /** Preavviso per le chiusure. */
    public static final int CLOSING_NOTICE_MINUTES = 60;

    private LiveGuidePlan() {
    }

    /** Numero del giorno del viaggio (1 = primo giorno) per `date`; 0 se fuori dal viaggio o date non valide. */
    public static int dayNumber(Trip trip, LocalDate date) {
        try {
            LocalDate start = LocalDate.parse(trip.getStartDate());
            LocalDate end = LocalDate.parse(trip.getEndDate());
            if (date.isBefore(start) || date.isAfter(end)) return 0;
            return (int) (date.toEpochDay() - start.toEpochDay()) + 1;
        } catch (DateTimeParseException | NullPointerException e) {
            return 0;
        }
    }

    /** Tappe del giorno `day`, ordinate per orario (quelle senza orario in fondo, nell'ordine scelto). */
    public static List<Stop> stopsOfDay(Trip trip, int day) {
        List<Stop> stops = new ArrayList<>();
        for (TripActivity a : trip.getActivities()) {
            if (!Objects.equals(a.getAssignedDay(), day)) continue;
            stops.add(new Stop("activity:" + a.getId(), a.getName(), false, null,
                    startOf(a.getStartTime(), a.getTimeSlot(), null), a.getDayOrder(),
                    Boolean.TRUE.equals(a.getIsCompleted()), Boolean.TRUE.equals(a.getIsSkipped()),
                    a.getOpeningHours(), a.getClosingDays()));
        }
        for (TripPlaceToEat p : trip.getPlacesToEat()) {
            if (!Objects.equals(p.getAssignedDay(), day)) continue;
            String meal = p.getAssignedMeal() != null && MEALS.contains(p.getAssignedMeal()) ? p.getAssignedMeal()
                    : p.getCategory() != null && MEALS.contains(p.getCategory()) ? p.getCategory() : null;
            stops.add(new Stop("food:" + p.getId(), p.getName(), true, meal,
                    startOf(p.getStartTime(), p.getTimeSlot(), p.getAssignedMeal()), p.getDayOrder(),
                    Boolean.TRUE.equals(p.getIsVisited()), Boolean.TRUE.equals(p.getIsSkipped()),
                    p.getOpeningHours(), p.getClosingDays()));
        }
        stops.sort(Comparator
                .comparing(Stop::start, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Stop::order, Comparator.nullsLast(Comparator.naturalOrder())));
        return stops;
    }

    /** Tutti gli eventi della giornata `date` del viaggio (vuoto fuori dalle date del viaggio). */
    public static List<Event> events(Trip trip, LocalDate date, LocalTime morning, LocalTime evening) {
        int day = dayNumber(trip, date);
        if (day == 0) return List.of();
        List<Stop> today = stopsOfDay(trip, day);
        if (today.isEmpty()) return List.of();
        boolean lastDay = dayNumber(trip, date.plusDays(1)) == 0;
        List<Stop> tomorrow = lastDay ? List.of() : stopsOfDay(trip, day + 1);

        List<Event> events = new ArrayList<>();
        events.add(new Event(Kind.MORNING, "", morning, null, null, today, tomorrow, lastDay));
        for (Stop s : today) {
            if (s.done() || s.skipped()) continue;
            if (s.food() && s.meal() != null && s.start() != null) {
                events.add(new Event(Kind.MEAL, s.ref(), s.start(), s, null, today, tomorrow, lastDay));
            }
            closingTime(s, date).ifPresent(closes -> events.add(new Event(Kind.CLOSING, s.ref(),
                    closes.minusMinutes(CLOSING_NOTICE_MINUTES), s, closes, today, tomorrow, lastDay)));
        }
        events.add(new Event(Kind.EVENING, "", evening, null, null, today, tomorrow, lastDay));
        return events;
    }

    /**
     * Gli eventi da inviare adesso: quelli il cui orario è passato da meno di `graceMinutes`
     * (un riavvio del backend non fa perdere le notifiche, ma non arrivano notifiche vecchie di ore).
     */
    public static List<Event> due(List<Event> events, LocalTime now, int graceMinutes) {
        int nowMin = now.toSecondOfDay() / 60;
        return events.stream()
                .filter(e -> {
                    int at = e.at().toSecondOfDay() / 60;
                    return at <= nowMin && nowMin < at + graceMinutes;
                })
                .toList();
    }

    /**
     * Orario di chiusura rilevante: la fine della fascia di apertura in cui cade l'orario della tappa
     * (senza orario: l'ultima fascia del giorno). Vuoto se gli orari non sono interpretabili, se la tappa
     * è chiusa quel giorno o se l'orario previsto è già dopo la chiusura (lì c'è un altro avviso nella guida).
     */
    public static Optional<LocalTime> closingTime(Stop stop, LocalDate date) {
        List<LocalTime[]> ranges = openingRanges(stop.openingHours());
        if (ranges.isEmpty() || closedWeekdays(stop.closingDays(), stop.openingHours()).contains(date.getDayOfWeek())) {
            return Optional.empty();
        }
        if (stop.start() == null) return Optional.of(ranges.get(ranges.size() - 1)[1]);
        return ranges.stream()
                .filter(r -> !stop.start().isBefore(r[0]) && stop.start().isBefore(r[1]))
                .map(r -> r[1])
                .findFirst();
    }

    /** "9:00-19:00", "09.00–13.00, 15.00–19.30", "9-17" → fasce [inizio, fine] (24 = 23:59). */
    public static List<LocalTime[]> openingRanges(String text) {
        List<LocalTime[]> ranges = new ArrayList<>();
        if (text == null) return ranges;
        Matcher m = HOURS.matcher(text);
        while (m.find()) {
            int h1 = Integer.parseInt(m.group(1));
            int m1 = m.group(2) == null ? 0 : Integer.parseInt(m.group(2));
            int h2 = Integer.parseInt(m.group(3));
            int m2 = m.group(4) == null ? 0 : Integer.parseInt(m.group(4));
            if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) continue;
            LocalTime start = LocalTime.of(h1, m1);
            LocalTime end = h2 == 24 ? LocalTime.of(23, 59) : LocalTime.of(h2, m2);
            if (end.isAfter(start)) ranges.add(new LocalTime[]{start, end});
        }
        ranges.sort(Comparator.comparing(r -> r[0]));
        return ranges;
    }

    /** Giorni di chiusura dal campo apposito e da un'indicazione negli orari ("9-17, chiuso il lunedì"). */
    public static Set<DayOfWeek> closedWeekdays(String closingDays, String openingHours) {
        Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        days.addAll(weekdaysIn(closingDays));
        if (openingHours != null) {
            Matcher m = CLOSED_WORD.matcher(openingHours);
            if (m.find()) days.addAll(weekdaysIn(openingHours.substring(m.start())));
        }
        return days;
    }

    private static Set<DayOfWeek> weekdaysIn(String text) {
        Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        if (text == null) return days;
        String lower = text.toLowerCase(Locale.ROOT);
        for (Map.Entry<Pattern, DayOfWeek> w : WEEKDAYS) {
            if (w.getKey().matcher(lower).find()) days.add(w.getValue());
        }
        return days;
    }

    private static LocalTime startOf(String startTime, String timeSlot, String assignedMeal) {
        if (TimeSlots.isValidTime(startTime)) return LocalTime.parse(startTime);
        Optional<TimeSlots.Range> slot = TimeSlots.parse(timeSlot);
        if (slot.isPresent()) return LocalTime.parse(slot.get().start());
        return assignedMeal == null ? null : MEAL_DEFAULTS.get(assignedMeal);
    }

    private static Map.Entry<Pattern, DayOfWeek> weekday(String words, DayOfWeek day) {
        return Map.entry(Pattern.compile("(?<![a-zà-ÿ])(?:" + words + ")(?![a-zà-ÿ])"), day);
    }
}
