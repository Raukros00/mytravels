package com.example.tripplanner.service;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.PushCategory;
import com.example.tripplanner.model.Trip;
import com.example.tripplanner.model.User;
import com.example.tripplanner.service.PushService.PushMessage;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

/**
 * Notifiche push legate ai gruppi, affiancate a quelle della campanella: inviti e richieste di
 * ingresso (#96), proposte di viaggio, approvazioni e nuovi membri (#98).
 * Punto unico per le push legate a un gruppo: nessuna push a chi ha silenziato il gruppo (ha la
 * precedenza su tutto) né a chi ha fatto l'azione; PushService poi scarta chi ha disattivato la
 * categoria nelle preferenze (#97). Testi nella lingua del
 * dispositivo ('en'), altrimenti in italiano. Il `tag` (evento + gruppo) fa sì che notifiche ripetute
 * si sostituiscano invece di accumularsi. L'invio parte dopo il commit (vedi PushService).
 */
@Component
public class GroupPushNotifier {

    private final PushService pushService;

    public GroupPushNotifier(PushService pushService) {
        this.pushService = pushService;
    }

    /** Invito diretto in un gruppo: all'utente invitato. */
    public void invite(Group group, User sender, String recipientId) {
        String name = group.getName();
        send(group, sender, List.of(recipientId), PushCategory.INVITES, lang -> "en".equals(lang)
                ? new PushMessage("New invitation", sender.getName() + " invited you to «" + name + "»", "/groups", tag("invite", group))
                : new PushMessage("Nuovo invito", sender.getName() + " ti ha invitato in «" + name + "»", "/groups", tag("invite", group)));
    }

    /** Nuova richiesta di ingresso: agli admin del gruppo, che la gestiscono dal dettaglio. */
    public void joinRequest(Group group, User requester) {
        List<String> admins = group.getMembers().stream()
                .filter(m -> "admin".equalsIgnoreCase(m.getRole()))
                .map(GroupMember::getId)
                .toList();
        String name = group.getName();
        String url = "/groups/" + group.getId();
        send(group, requester, admins, PushCategory.INVITES, lang -> "en".equals(lang)
                ? new PushMessage("Join request", requester.getName() + " wants to join «" + name + "»", url, tag("join-request", group))
                : new PushMessage("Richiesta di ingresso", requester.getName() + " chiede di entrare in «" + name + "»", url, tag("join-request", group)));
    }

    /** Esito della richiesta: al richiedente. */
    public void joinDecision(Group group, User admin, String requesterId, boolean approved) {
        String name = group.getName();
        if (approved) {
            String url = "/groups/" + group.getId();
            send(group, admin, List.of(requesterId), PushCategory.INVITES, lang -> "en".equals(lang)
                    ? new PushMessage("Request accepted", "You joined «" + name + "»", url, tag("join-decision", group))
                    : new PushMessage("Richiesta accettata", "Sei entrato in «" + name + "»", url, tag("join-decision", group)));
        } else {
            send(group, admin, List.of(requesterId), PushCategory.INVITES, lang -> "en".equals(lang)
                    ? new PushMessage("Request declined", "Your request to join «" + name + "» was not accepted", "/groups", tag("join-decision", group))
                    : new PushMessage("Richiesta non accettata", "La tua richiesta per «" + name + "» non è stata accettata", "/groups", tag("join-decision", group)));
        }
    }

    /** Nuova proposta di viaggio: a tutti i membri tranne l'autore; si apre il gruppo, dove si vota. */
    public void tripProposed(Group group, Trip trip, User author) {
        String title = trip.getTitle();
        String url = "/groups/" + group.getId();
        String tag = "proposal:" + trip.getId();
        send(group, author, memberIds(group), PushCategory.PROPOSALS, lang -> "en".equals(lang)
                ? new PushMessage("New trip proposal", author.getName() + " proposes «" + title + "»: vote!", url, tag)
                : new PushMessage("Nuova proposta di viaggio", author.getName() + " propone «" + title + "»: vota!", url, tag));
    }

    /** Proposta approvata per maggioranza: a tutti i membri (anche a chi ha dato il voto decisivo); si apre il viaggio. */
    public void tripApproved(Group group, Trip trip) {
        String title = trip.getTitle();
        String url = "/trips/" + trip.getId();
        String tag = "proposal:" + trip.getId();
        send(group, Set.of(), memberIds(group), PushCategory.PROPOSALS, lang -> "en".equals(lang)
                ? new PushMessage("Trip chosen", "«" + title + "» has been chosen by the group 🎉", url, tag)
                : new PushMessage("Viaggio scelto", "«" + title + "» è stato scelto dal gruppo 🎉", url, tag));
    }

    /**
     * Nuovo membro nel gruppo: agli altri membri che hanno attivato la categoria "nuovi membri".
     * Esclusi il nuovo arrivato e chi lo ha fatto entrare (`exceptIds`, es. l'admin che ha approvato).
     */
    public void memberJoined(Group group, String memberId, String memberName, Collection<String> exceptIds) {
        String name = group.getName();
        String url = "/groups/" + group.getId();
        String who = memberName == null || memberName.isBlank() ? "Traveler" : memberName;
        Set<String> exclude = new java.util.HashSet<>(exceptIds);
        exclude.add(memberId);
        send(group, exclude, memberIds(group), PushCategory.NEW_MEMBERS, lang -> "en".equals(lang)
                ? new PushMessage("New member", who + " joined «" + name + "»", url, tag("new-member", group))
                : new PushMessage("Nuovo membro", who + " è entrato in «" + name + "»", url, tag("new-member", group)));
    }

    /**
     * Promemoria prima della partenza (#99) ai destinatari indicati (membri attuali, già filtrati dal
     * job per l'invio unico): "Mancano 3 giorni a …" o "Domani si parte per …". Si apre il viaggio.
     */
    public void tripReminder(Group group, Trip trip, boolean tomorrow, List<String> recipients) {
        String place = trip.getDestination() == null || trip.getDestination().isBlank() ? trip.getTitle() : trip.getDestination();
        String title = trip.getTitle();
        String url = "/trips/" + trip.getId();
        String tag = "reminder:" + trip.getId();
        send(group, Set.of(), recipients, PushCategory.REMINDERS, lang -> {
            if ("en".equals(lang)) {
                return tomorrow
                        ? new PushMessage(title, "Tomorrow you leave for " + place + "!", url, tag)
                        : new PushMessage(title, "3 days to go until " + place + " ✈️", url, tag);
            }
            return tomorrow
                    ? new PushMessage(title, "Domani si parte per " + place + "!", url, tag)
                    : new PushMessage(title, "Mancano 3 giorni a " + place + " ✈️", url, tag);
        });
    }

    private static List<String> memberIds(Group group) {
        return group.getMembers().stream().map(GroupMember::getId).toList();
    }

    /** Invio ai destinatari, esclusi l'autore e chi ha silenziato il gruppo; preferenze applicate da PushService. */
    void send(Group group, User actor, List<String> recipients, PushCategory category, Function<String, PushMessage> message) {
        send(group, actor == null || actor.getId() == null ? Set.of() : Set.of(actor.getId()), recipients, category, message);
    }

    void send(Group group, Set<String> exclude, List<String> recipients, PushCategory category, Function<String, PushMessage> message) {
        List<String> muted = group.getMutedBy() == null ? List.of() : group.getMutedBy();
        List<String> targets = recipients.stream()
                .filter(Objects::nonNull)
                .filter(id -> !exclude.contains(id))
                .filter(id -> !muted.contains(id))
                .distinct()
                .toList();
        if (!targets.isEmpty()) pushService.sendToUsers(targets, category, message);
    }

    private static String tag(String event, Group group) {
        return event + ":" + group.getId();
    }
}
