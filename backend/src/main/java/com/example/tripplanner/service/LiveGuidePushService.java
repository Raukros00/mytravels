package com.example.tripplanner.service;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.Trip;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.util.AppDates;
import com.example.tripplanner.util.LiveGuidePlan;
import com.example.tripplanner.util.LiveGuidePlan.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Notifiche push della guida durante il viaggio (#110): buongiorno con il programma, pasti, chiusure imminenti e
 * fine giornata (vedi {@link LiveGuidePlan}), ai membri del gruppo dei viaggi confermati in corso. Ogni notifica
 * apre la guida {@code /trips/:id/live}.
 *
 * Il job gira ogni 5 minuti dalle 7:00 alle 23:55 ora italiana ({@code push.live-guide.cron}, fuso Europe/Rome,
 * come le date dell'app). Una notifica parte al primo giro dopo il suo orario, entro {@code grace-minutes}
 * (dopo un riavvio si recupera, ma non arrivano notifiche vecchie di ore). È idempotente: ogni invio è registrato
 * in {@code trip_live_notifications_sent} (viaggio, utente, tipo, giorno, tappa) con {@code ON CONFLICT DO NOTHING}.
 * Gruppi silenziati e preferenza "Guida durante il viaggio" sono applicati da GroupPushNotifier/PushService.
 */
@Service
public class LiveGuidePushService {

    private static final Logger log = LoggerFactory.getLogger(LiveGuidePushService.class);

    private final TripRepository tripRepository;
    private final GroupRepository groupRepository;
    private final GroupPushNotifier pushNotifier;
    private final PushService pushService;
    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final LocalTime morning;
    private final LocalTime evening;
    private final int graceMinutes;

    public LiveGuidePushService(TripRepository tripRepository,
                                GroupRepository groupRepository,
                                GroupPushNotifier pushNotifier,
                                PushService pushService,
                                JdbcTemplate jdbc,
                                @Value("${push.live-guide.enabled:true}") boolean enabled,
                                @Value("${push.live-guide.morning-time:08:30}") String morning,
                                @Value("${push.live-guide.evening-time:21:30}") String evening,
                                @Value("${push.live-guide.grace-minutes:60}") int graceMinutes) {
        this.tripRepository = tripRepository;
        this.groupRepository = groupRepository;
        this.pushNotifier = pushNotifier;
        this.pushService = pushService;
        this.jdbc = jdbc;
        this.enabled = enabled;
        this.morning = LocalTime.parse(morning);
        this.evening = LocalTime.parse(evening);
        this.graceMinutes = Math.max(5, graceMinutes);
    }

    @Scheduled(cron = "${push.live-guide.cron:0 */5 7-23 * * *}", zone = "Europe/Rome")
    public void scheduled() {
        if (!enabled || !pushService.isEnabled()) return;
        try {
            run(LocalDateTime.now(AppDates.ZONE));
        } catch (Exception e) {
            log.warn("Notifiche della guida non riuscite: {}", e.getMessage());
        }
    }

    /**
     * Invia le notifiche dovute all'istante `now` (ora italiana). Restituisce quante notifiche sono state
     * registrate per tipo (per i test).
     */
    public synchronized Map<String, Integer> run(LocalDateTime now) {
        Map<String, Integer> sent = new LinkedHashMap<>();
        for (LiveGuidePlan.Kind kind : LiveGuidePlan.Kind.values()) sent.put(kind.code, 0);
        String today = now.toLocalDate().toString();
        for (Trip trip : tripRepository.findByDecisionAndStartDateLessThanEqualAndEndDateGreaterThanEqual("confirmed", today, today)) {
            List<Event> due = LiveGuidePlan.due(LiveGuidePlan.events(trip, now.toLocalDate(), morning, evening),
                    now.toLocalTime(), graceMinutes);
            if (due.isEmpty()) continue;
            Optional<Group> group = groupRepository.findById(trip.getGroupId());
            if (group.isEmpty() || Boolean.TRUE.equals(group.get().getArchived())) continue;
            for (Event event : due) {
                int count = notify(group.get(), trip, today, event);
                sent.merge(event.kind().code, count, Integer::sum);
            }
        }
        if (sent.values().stream().anyMatch(n -> n > 0)) log.info("Notifiche della guida registrate: {}", sent);
        return sent;
    }

    private int notify(Group group, Trip trip, String day, Event event) {
        List<String> recipients = new ArrayList<>();
        for (GroupMember member : group.getMembers()) {
            if (member.getId() != null && markSent(trip, member.getId(), event, day)) recipients.add(member.getId());
        }
        if (!recipients.isEmpty()) pushNotifier.liveGuide(group, trip, event, recipients);
        return recipients.size();
    }

    /** true solo la prima volta per (viaggio, utente, tipo, giorno, tappa). */
    private boolean markSent(Trip trip, String userId, Event event, String day) {
        return jdbc.update("""
                INSERT INTO trip_live_notifications_sent (trip_id, user_id, kind, day_date, ref)
                SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
                ON CONFLICT DO NOTHING""",
                trip.getId(), userId, event.kind().code, day, event.ref(), userId) > 0;
    }
}
