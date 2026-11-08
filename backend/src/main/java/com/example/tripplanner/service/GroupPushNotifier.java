package com.example.tripplanner.service;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.User;
import com.example.tripplanner.service.PushService.PushMessage;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;

/**
 * Notifiche push per inviti e richieste di ingresso ai gruppi (#96), affiancate a quelle della campanella.
 * Nessuna push a chi ha silenziato il gruppo né a chi ha fatto l'azione. Testi nella lingua del
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
        send(group, sender, List.of(recipientId), lang -> "en".equals(lang)
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
        send(group, requester, admins, lang -> "en".equals(lang)
                ? new PushMessage("Join request", requester.getName() + " wants to join «" + name + "»", url, tag("join-request", group))
                : new PushMessage("Richiesta di ingresso", requester.getName() + " chiede di entrare in «" + name + "»", url, tag("join-request", group)));
    }

    /** Esito della richiesta: al richiedente. */
    public void joinDecision(Group group, User admin, String requesterId, boolean approved) {
        String name = group.getName();
        if (approved) {
            String url = "/groups/" + group.getId();
            send(group, admin, List.of(requesterId), lang -> "en".equals(lang)
                    ? new PushMessage("Request accepted", "You joined «" + name + "»", url, tag("join-decision", group))
                    : new PushMessage("Richiesta accettata", "Sei entrato in «" + name + "»", url, tag("join-decision", group)));
        } else {
            send(group, admin, List.of(requesterId), lang -> "en".equals(lang)
                    ? new PushMessage("Request declined", "Your request to join «" + name + "» was not accepted", "/groups", tag("join-decision", group))
                    : new PushMessage("Richiesta non accettata", "La tua richiesta per «" + name + "» non è stata accettata", "/groups", tag("join-decision", group)));
        }
    }

    private void send(Group group, User actor, List<String> recipients, Function<String, PushMessage> message) {
        List<String> muted = group.getMutedBy() == null ? List.of() : group.getMutedBy();
        List<String> targets = recipients.stream()
                .filter(Objects::nonNull)
                .filter(id -> actor == null || !id.equals(actor.getId()))
                .filter(id -> !muted.contains(id))
                .distinct()
                .toList();
        if (!targets.isEmpty()) pushService.sendToUsers(targets, message);
    }

    private static String tag(String event, Group group) {
        return event + ":" + group.getId();
    }
}
