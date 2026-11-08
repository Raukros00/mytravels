package com.example.tripplanner.service;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.Trip;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.util.AppDates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Promemoria push prima della partenza (#99): "Mancano 3 giorni a …" e "Domani si parte per …",
 * solo per i viaggi confermati, a tutti i membri attuali del gruppo.
 *
 * Il job gira ogni 15 minuti dalle 9:00 alle 21:45 ora italiana (`push.reminders.cron`, fuso
 * Europe/Rome): il primo giro utile è alle 9:00; se il backend era spento, parte al primo giro dopo
 * il riavvio. È idempotente: ogni invio è registrato in `trip_reminders_sent` con chiave
 * (viaggio, utente, tipo, data di partenza) e l'inserimento `ON CONFLICT DO NOTHING` decide chi deve
 * ancora riceverlo. Se la data del viaggio cambia, la chiave cambia e i promemoria seguono la nuova data.
 * Silenziamento del gruppo e preferenza "Promemoria" sono applicati da GroupPushNotifier/PushService.
 */
@Service
public class TripReminderService {

    /** Tipi di promemoria: giorni che mancano alla partenza. */
    public enum Kind {
        THREE_DAYS("three_days", 3),
        DAY_BEFORE("day_before", 1);

        final String code;
        final int daysBefore;

        Kind(String code, int daysBefore) {
            this.code = code;
            this.daysBefore = daysBefore;
        }
    }

    private static final Logger log = LoggerFactory.getLogger(TripReminderService.class);

    private final TripRepository tripRepository;
    private final GroupRepository groupRepository;
    private final GroupPushNotifier pushNotifier;
    private final PushService pushService;
    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public TripReminderService(TripRepository tripRepository,
                               GroupRepository groupRepository,
                               GroupPushNotifier pushNotifier,
                               PushService pushService,
                               JdbcTemplate jdbc,
                               @Value("${push.reminders.enabled:true}") boolean enabled) {
        this.tripRepository = tripRepository;
        this.groupRepository = groupRepository;
        this.pushNotifier = pushNotifier;
        this.pushService = pushService;
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    @Scheduled(cron = "${push.reminders.cron:0 */15 9-21 * * *}", zone = "Europe/Rome")
    public void scheduled() {
        if (!enabled || !pushService.isEnabled()) return;
        try {
            run(AppDates.today());
        } catch (Exception e) {
            log.warn("Promemoria dei viaggi non riuscito: {}", e.getMessage());
        }
    }

    /**
     * Invia i promemoria dovuti `today` (data italiana): viaggi confermati che partono tra 3 giorni
     * o domani. Restituisce quanti promemoria sono stati registrati per tipo (per i test).
     */
    public synchronized Map<String, Integer> run(LocalDate today) {
        Map<String, Integer> sent = new LinkedHashMap<>();
        for (Kind kind : Kind.values()) {
            String startDate = today.plusDays(kind.daysBefore).toString();
            int count = 0;
            for (Trip trip : tripRepository.findByDecisionAndStartDate("confirmed", startDate)) {
                count += remind(trip, kind);
            }
            sent.put(kind.code, count);
        }
        if (sent.values().stream().anyMatch(n -> n > 0)) log.info("Promemoria dei viaggi registrati: {}", sent);
        return sent;
    }

    private int remind(Trip trip, Kind kind) {
        Optional<Group> found = groupRepository.findById(trip.getGroupId());
        if (found.isEmpty() || Boolean.TRUE.equals(found.get().getArchived())) return 0;
        Group group = found.get();
        List<String> recipients = new ArrayList<>();
        for (GroupMember member : group.getMembers()) {
            if (member.getId() != null && markSent(trip, member.getId(), kind)) recipients.add(member.getId());
        }
        if (!recipients.isEmpty()) pushNotifier.tripReminder(group, trip, kind == Kind.DAY_BEFORE, recipients);
        return recipients.size();
    }

    /** true solo la prima volta per (viaggio, utente, tipo, data di partenza). */
    private boolean markSent(Trip trip, String userId, Kind kind) {
        return jdbc.update("""
                INSERT INTO trip_reminders_sent (trip_id, user_id, kind, start_date)
                SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
                ON CONFLICT DO NOTHING""",
                trip.getId(), userId, kind.code, trip.getStartDate(), userId) > 0;
    }
}
