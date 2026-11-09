package com.example.tripplanner.service;

import com.example.tripplanner.dto.UpdateProfileDto;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupJoinRequest;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupJoinRequestRepository;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.NotificationRepository;
import com.example.tripplanner.repository.PushPreferencesRepository;
import com.example.tripplanner.repository.PushSubscriptionRepository;
import com.example.tripplanner.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Operazioni dell'utente sul proprio account (Profilo, epica #113). */
@Service
public class UserService {

    /** Nome mostrato al posto di quello di un account eliminato, dove ne resta una copia (#121). */
    public static final String DELETED_USER_NAME = "Utente eliminato";

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final GroupService groupService;
    private final GroupJoinRequestRepository joinRequestRepository;
    private final NotificationRepository notificationRepository;
    private final PushPreferencesRepository pushPreferencesRepository;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final EntityManager em;

    public UserService(UserRepository userRepository, GroupRepository groupRepository, GroupService groupService,
                       GroupJoinRequestRepository joinRequestRepository, NotificationRepository notificationRepository,
                       PushPreferencesRepository pushPreferencesRepository,
                       PushSubscriptionRepository pushSubscriptionRepository, EntityManager em) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.groupService = groupService;
        this.joinRequestRepository = joinRequestRepository;
        this.notificationRepository = notificationRepository;
        this.pushPreferencesRepository = pushPreferencesRepository;
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.em = em;
    }

    /**
     * Aggiorna nome, cognome, data di nascita, foto e avatar dell'utente (#120).
     * <p>
     * Nome, avatar, colore e foto sono <b>copiati</b> in alcune tabelle (membri dei gruppi, richieste di
     * accesso in attesa, mittente delle notifiche): si aggiornano anche lì nella stessa transazione, così
     * il nuovo nome compare subito ovunque senza cambiare il formato delle API.
     */
    @Transactional
    public User updateProfile(User user, UpdateProfileDto dto) {
        String first = dto.getFirstName().trim();
        String last = dto.getLastName().trim();
        user.setFirstName(first);
        user.setLastName(last);
        user.setName(first + " " + last);
        user.setBirthDate(dto.getBirthDate());
        user.setProfileImage(dto.getProfileImage() == null || dto.getProfileImage().isBlank() ? null : dto.getProfileImage());
        if (dto.getAvatar() != null && !dto.getAvatar().isBlank()) user.setAvatar(dto.getAvatar().trim());
        if (dto.getColor() != null && !dto.getColor().isBlank()) user.setColor(dto.getColor().toLowerCase());
        User saved = userRepository.saveAndFlush(user);
        propagateProfile(saved);
        return saved;
    }

    /** Copia i dati pubblici dell'utente dove sono duplicati (vedi {@link #updateProfile}). */
    private void propagateProfile(User u) {
        em.createQuery("update GroupMember m set m.name = :name, m.avatar = :avatar, m.color = :color, "
                        + "m.profileImage = :image where m.id = :uid")
                .setParameter("name", u.getName())
                .setParameter("avatar", u.getAvatar())
                .setParameter("color", u.getColor())
                .setParameter("image", u.getProfileImage())
                .setParameter("uid", u.getId())
                .executeUpdate();
        // Solo le richieste in attesa: quelle già decise sono storico.
        em.createQuery("update GroupJoinRequest r set r.userName = :name, r.avatar = :avatar, r.color = :color, "
                        + "r.profileImage = :image where r.userId = :uid and r.status = 'pending'")
                .setParameter("name", u.getName())
                .setParameter("avatar", u.getAvatar())
                .setParameter("color", u.getColor())
                .setParameter("image", u.getProfileImage())
                .setParameter("uid", u.getId())
                .executeUpdate();
        em.createQuery("update Notification n set n.senderName = :name where n.senderId = :uid")
                .setParameter("name", u.getName())
                .setParameter("uid", u.getId())
                .executeUpdate();
    }

    // ── Eliminazione dell'account (#121) ────────────────────────────────────────────────────────────

    /** Gruppo citato nelle regole di eliminazione (id e nome, per l'elenco con link). */
    public record GroupRef(String id, String name) {}

    /** Effetto dell'eliminazione sui gruppi: quelli che la bloccano e quelli che verrebbero eliminati. */
    public record DeletionImpact(List<GroupRef> blockingGroups, List<GroupRef> groupsToDelete) {}

    /** L'utente è l'unico admin di gruppi con altri membri: deve prima nominare un altro admin (409). */
    public static class DeletionBlockedException extends RuntimeException {
        private final List<GroupRef> groups;
        public DeletionBlockedException(List<GroupRef> groups) {
            super("Sei l'unico amministratore di alcuni gruppi con altri membri: nomina prima un altro amministratore");
            this.groups = groups;
        }
        public List<GroupRef> getGroups() { return groups; }
    }

    /** Regole della #78 applicate a tutti i gruppi dell'utente (anche archiviati). */
    public DeletionImpact deletionImpact(String userId) {
        List<GroupRef> blocking = new ArrayList<>();
        List<GroupRef> toDelete = new ArrayList<>();
        for (Group g : groupRepository.findByUserId(userId)) {
            GroupMember me = g.getMembers().stream().filter(m -> userId.equals(m.getId())).findFirst().orElse(null);
            if (me == null) continue;
            List<GroupMember> others = g.getMembers().stream().filter(m -> m != me).toList();
            if (others.isEmpty()) {
                toDelete.add(new GroupRef(g.getId(), g.getName()));
            } else if (GroupService.ROLE_ADMIN.equalsIgnoreCase(me.getRole())
                    && others.stream().noneMatch(m -> GroupService.ROLE_ADMIN.equalsIgnoreCase(m.getRole()))) {
                blocking.add(new GroupRef(g.getId(), g.getName()));
            }
        }
        return new DeletionImpact(blocking, toDelete);
    }

    /**
     * Elimina l'account in un'unica transazione (la password è già stata verificata dal controller).
     * <ul>
     *   <li>gruppi in cui è l'unico membro: eliminati con i loro viaggi;</li>
     *   <li>altri gruppi: l'utente esce (e viene ricordato in {@code deletedMemberIds}); viaggi, attività,
     *       spese, proposte e voti restano al gruppo;</li>
     *   <li>notifiche ricevute, richieste di accesso (e le notifiche agli admin che le riguardano): eliminate;
     *       nelle notifiche inviate ad altri il mittente diventa "Utente eliminato";</li>
     *   <li>riga dell'utente (con foto): eliminata; abbonamenti e preferenze push, registri dei promemoria e
     *       della guida vanno via con {@code ON DELETE CASCADE}; {@code groups.creator_id} diventa NULL.</li>
     * </ul>
     *
     * @throws DeletionBlockedException se è l'unico admin di gruppi con altri membri
     */
    @Transactional
    public void deleteAccount(User user) {
        String uid = user.getId();
        DeletionImpact impact = deletionImpact(uid);
        if (!impact.blockingGroups().isEmpty()) throw new DeletionBlockedException(impact.blockingGroups());

        for (GroupRef ref : impact.groupsToDelete()) groupService.deleteGroup(ref.id());
        for (Group g : groupRepository.findByUserId(uid)) {
            g.getMembers().removeIf(m -> uid.equals(m.getId()));
            g.getMutedBy().remove(uid);
            g.getDeletedMemberIds().add(uid);
            groupRepository.save(g);
        }
        groupRepository.flush();

        List<String> requestIds = joinRequestRepository.findByUserId(uid).stream().map(GroupJoinRequest::getId).toList();
        if (!requestIds.isEmpty()) {
            em.createQuery("delete from Notification n where n.requestId in :ids").setParameter("ids", requestIds).executeUpdate();
            em.createQuery("delete from GroupJoinRequest r where r.id in :ids").setParameter("ids", requestIds).executeUpdate();
        }
        em.createQuery("delete from Notification n where n.recipientId = :uid").setParameter("uid", uid).executeUpdate();
        em.createQuery("update Notification n set n.senderName = :name, n.senderId = null where n.senderId = :uid")
                .setParameter("name", DELETED_USER_NAME).setParameter("uid", uid).executeUpdate();
        // Elenco "silenziato" anche in gruppi dove non è più membro (es. uscito in passato).
        em.createNativeQuery("delete from group_muted_users where user_id = :uid").setParameter("uid", uid).executeUpdate();

        em.clear();
        em.createQuery("delete from User u where u.id = :uid").setParameter("uid", uid).executeUpdate();
    }

    /**
     * "Scarica i miei dati" (#121): i dati personali dell'utente in JSON (profilo senza password, gruppi
     * e ruolo, richieste di accesso, notifiche ricevute, preferenze e dispositivi per le notifiche push).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportData(User user) {
        String uid = user.getId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exportedAt", Instant.now().toString());
        out.put("profile", com.example.tripplanner.dto.UserResponse.from(user));
        out.put("groups", groupRepository.findByUserId(uid).stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", g.getId());
            m.put("name", g.getName());
            m.put("role", g.getMembers().stream().filter(x -> uid.equals(x.getId())).map(GroupMember::getRole).findFirst().orElse(null));
            m.put("muted", g.getMutedBy().contains(uid));
            return m;
        }).toList());
        out.put("joinRequests", joinRequestRepository.findByUserId(uid).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("groupId", r.getGroupId());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            m.put("decidedAt", r.getDecidedAt());
            return m;
        }).toList());
        out.put("notifications", notificationRepository.findByRecipientIdOrderByCreatedAtDesc(uid).stream().map(n -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", n.getType());
            m.put("from", n.getSenderName());
            m.put("group", n.getGroupName());
            m.put("createdAt", n.getCreatedAt());
            m.put("read", n.getRead());
            m.put("status", n.getStatus());
            return m;
        }).toList());
        out.put("pushPreferences", pushPreferencesRepository.findById(uid).map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("invites", p.isInvites());
            m.put("proposals", p.isProposals());
            m.put("newMembers", p.isNewMembers());
            m.put("reminders", p.isReminders());
            m.put("liveGuide", p.isLiveGuide());
            return m;
        }).orElse(null));
        out.put("pushDevices", pushSubscriptionRepository.findByUserIdOrderByCreatedAtDesc(uid).stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userAgent", s.getUserAgent());
            m.put("lang", s.getLang());
            m.put("createdAt", s.getCreatedAt() != null ? s.getCreatedAt().toString() : null);
            m.put("lastUsedAt", s.getLastUsedAt() != null ? s.getLastUsedAt().toString() : null);
            return m;
        }).toList());
        return out;
    }
}
