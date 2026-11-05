package com.example.tripplanner.controller;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.Notification;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.NotificationRepository;
import com.example.tripplanner.repository.UserRepository;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Notifiche dell'utente autenticato. Ogni operazione è limitata alle proprie notifiche:
 * gli eventuali recipientId passati dal client vengono ignorati.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final GroupAccess groupAccess;

    public NotificationController(NotificationService notificationService,
                                  NotificationRepository notificationRepository,
                                  UserRepository userRepository,
                                  GroupAccess groupAccess) {
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.groupAccess = groupAccess;
    }

    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(notificationService.getNotificationsForUser(me.get().getId()));
    }

    /**
     * Invito diretto a un gruppo (cercando l'utente). Solo un membro può invitare; mittente e dati
     * del gruppo vengono dal server. Se c'è già un invito in attesa per lo stesso utente, lo restituisce.
     */
    @PostMapping
    public ResponseEntity<?> invite(@RequestBody Map<String, String> body, Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<Group> group = groupAccess.memberGroup(body.get("groupId"), auth);
        if (group.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        String recipientId = body.get("recipientId");
        if (recipientId == null || userRepository.findById(recipientId).isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Utente non trovato."));
        }
        if (GroupAccess.isMember(group.get(), recipientId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "L'utente fa già parte del gruppo."));
        }
        Optional<Notification> existing = notificationRepository
                .findFirstByTypeAndRecipientIdAndGroupIdAndStatus("group_invite", recipientId, group.get().getId(), "pending");
        if (existing.isPresent()) return ResponseEntity.ok(existing.get());

        Notification created = notificationRepository.save(Notification.builder()
                .id("notif_" + UUID.randomUUID().toString().substring(0, 8))
                .type("group_invite")
                .recipientId(recipientId)
                .senderId(me.get().getId())
                .senderName(me.get().getName())
                .groupId(group.get().getId())
                .groupName(group.get().getName())
                .groupIcon(group.get().getIcon())
                .groupColor(group.get().getColor())
                .createdAt(Instant.now().toString())
                .read(false)
                .status("pending")
                .build());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Inviti diretti in attesa per un gruppo (per mostrarli e poterli revocare): solo per i membri.
     * Per ogni invito, il profilo pubblico dell'invitato (un invito per utente).
     */
    @GetMapping("/group/{groupId}/invites")
    public ResponseEntity<List<Map<String, Object>>> groupInvites(@PathVariable String groupId, Authentication auth) {
        if (groupAccess.memberGroup(groupId, auth).isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        java.util.Set<String> seen = new java.util.HashSet<>();
        List<Map<String, Object>> invites = notificationRepository
                .findByGroupIdAndTypeAndStatusOrderByCreatedAtDesc(groupId, "group_invite", "pending").stream()
                .filter(n -> seen.add(n.getRecipientId()))
                .map(n -> {
                    Optional<User> u = userRepository.findById(n.getRecipientId());
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("notifId", n.getId());
                    m.put("recipientId", n.getRecipientId());
                    m.put("name", u.map(User::getName).orElse("Utente"));
                    m.put("avatar", u.map(User::getAvatar).orElse(null));
                    m.put("color", u.map(User::getColor).orElse(null));
                    m.put("profileImage", u.map(User::getProfileImage).orElse(null));
                    m.put("invitedBy", n.getSenderName());
                    return m;
                })
                .toList();
        return ResponseEntity.ok(invites);
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable String id, Authentication auth) {
        if (own(id, auth).isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return notificationService.markAsRead(id).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead(Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        notificationService.markAllRead(me.get().getId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }

    /** Accetta un invito diretto: l'utente entra nel gruppo. */
    @PutMapping("/{id}/accept")
    public ResponseEntity<Notification> acceptInvite(@PathVariable String id, Authentication auth) {
        Optional<Notification> notif = own(id, auth).filter(n -> "group_invite".equals(n.getType()));
        if (notif.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return notificationService.acceptInvite(id).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/decline")
    public ResponseEntity<Notification> declineInvite(@PathVariable String id, Authentication auth) {
        Optional<Notification> notif = own(id, auth).filter(n -> "group_invite".equals(n.getType()));
        if (notif.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        return notificationService.declineInvite(id).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    /** Elimina una propria notifica, oppure revoca un invito inviato a un membro del proprio gruppo. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable String id, Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<Notification> notif = notificationRepository.findById(id);
        boolean allowed = notif.isPresent() && (
                me.get().getId().equals(notif.get().getRecipientId())
                || ("group_invite".equals(notif.get().getType()) && groupAccess.memberGroup(notif.get().getGroupId(), auth).isPresent()));
        if (!allowed) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(Map.of("message", "Notification deleted successfully"));
    }

    private Optional<Notification> own(String id, Authentication auth) {
        Optional<User> me = groupAccess.currentUser(auth);
        if (me.isEmpty()) return Optional.empty();
        return notificationRepository.findById(id).filter(n -> me.get().getId().equals(n.getRecipientId()));
    }
}
