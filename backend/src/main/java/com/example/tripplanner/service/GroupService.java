package com.example.tripplanner.service;

import com.example.tripplanner.util.AppDates;
import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.JoinGroupRequest;
import com.example.tripplanner.dto.UpdateGroupRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final TripRepository tripRepository;

    public GroupService(GroupRepository groupRepository, UserRepository userRepository, TripRepository tripRepository) {
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.tripRepository = tripRepository;
    }

    /** Immagine del gruppo: data URL JPEG/PNG/WebP, come la foto profilo (il client invia un JPEG ritagliato). */
    private static final Pattern IMAGE_ICON = Pattern.compile("^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$");
    /** Limite ~300 KB di immagine, come per la foto profilo. */
    static final int MAX_IMAGE_ICON_LENGTH = 400_000;
    /** Un'emoji (anche composta, es. famiglie o bandiere) sta comodamente in 16 caratteri UTF-16. */
    static final int MAX_EMOJI_ICON_LENGTH = 16;

    /**
     * L'icona è un'emoji (testo breve, mai un URL) oppure un'immagine data URL di dimensione limitata.
     * Vuota/null = nessuna modifica (o icona di default alla creazione).
     */
    static void validateIcon(String icon) {
        if (icon == null || icon.isBlank()) return;
        if (icon.startsWith("data:")) {
            if (icon.length() > MAX_IMAGE_ICON_LENGTH) {
                throw new IllegalArgumentException("Immagine del gruppo troppo grande (massimo 300 KB)");
            }
            if (!IMAGE_ICON.matcher(icon).matches()) {
                throw new IllegalArgumentException("Formato immagine del gruppo non valido: usa JPG, PNG o WebP");
            }
            return;
        }
        if (icon.length() > MAX_EMOJI_ICON_LENGTH || icon.contains(":") || icon.contains("/")) {
            throw new IllegalArgumentException("Icona del gruppo non valida: usa un'emoji o un'immagine");
        }
    }

    @Transactional
    public Group createGroup(CreateGroupRequest request, String defaultUserId) {
        validateIcon(request.getIcon());
        String creatorId = request.getCreatorId() != null && !request.getCreatorId().isBlank()
                ? request.getCreatorId()
                : defaultUserId;

        String inviteCode = "GRP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 5).toUpperCase();

        Group group = Group.builder()
                .id(UUID.randomUUID().toString())
                .name(request.getName().trim())
                .description(request.getDescription() != null ? request.getDescription().trim() : "")
                .icon(request.getIcon() != null && !request.getIcon().isBlank() ? request.getIcon() : "✈️")
                .color(request.getColor() != null && !request.getColor().isBlank() ? request.getColor() : "#4f46e5")
                .creatorId(creatorId)
                .inviteCode(inviteCode)
                .createdAt(AppDates.todayIso())
                .currency(request.getCurrency() != null && !request.getCurrency().isBlank() ? request.getCurrency() : "EUR")
                .archived(false)
                .mutedBy(new ArrayList<>())
                .members(new ArrayList<>())
                .build();

        if (creatorId != null) {
            Optional<User> creatorOpt = userRepository.findById(creatorId);
            if (creatorOpt.isEmpty()) {
                creatorOpt = userRepository.findByEmail(creatorId);
            }
            GroupMember member;
            if (creatorOpt.isPresent()) {
                User u = creatorOpt.get();
                member = GroupMember.builder()
                        .id(u.getId())
                        .name(u.getName())
                        .avatar(u.getAvatar())
                        .profileImage(u.getProfileImage())
                        .role("admin")
                        .color(u.getColor())
                        .build();
            } else {
                member = GroupMember.builder()
                        .id(creatorId)
                        .name("Admin")
                        .avatar("👑")
                        .role("admin")
                        .color(request.getColor() != null ? request.getColor() : "#4f46e5")
                        .build();
            }
            member.setGroup(group);
            group.getMembers().add(member);
        }

        return groupRepository.save(group);
    }

    public Optional<Group> getGroup(String id) {
        return groupRepository.findById(id);
    }

    public List<Group> getAllGroups() {
        return groupRepository.findAll();
    }

    public List<Group> getGroupsByUser(String userId) {
        return groupRepository.findByUserId(userId);
    }

    @Transactional
    public Optional<Group> updateGroup(String id, UpdateGroupRequest request) {
        validateIcon(request.getIcon());
        return groupRepository.findById(id).map(existing -> {
            if (request.getName() != null && !request.getName().isBlank()) {
                existing.setName(request.getName().trim());
            }
            if (request.getDescription() != null) {
                existing.setDescription(request.getDescription().trim());
            }
            if (request.getIcon() != null && !request.getIcon().isBlank()) {
                existing.setIcon(request.getIcon());
            }
            if (request.getColor() != null && !request.getColor().isBlank()) {
                existing.setColor(request.getColor());
            }
            if (request.getCurrency() != null && !request.getCurrency().isBlank()) {
                existing.setCurrency(request.getCurrency());
            }
            if (request.getArchived() != null) {
                existing.setArchived(request.getArchived());
            }
            return groupRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteGroup(String id) {
        if (groupRepository.existsById(id)) {
            tripRepository.deleteByGroupId(id);
            groupRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Transactional
    public Optional<Group> joinGroupByInvite(JoinGroupRequest request) {
        String cleanCode = request.getInviteCode().trim().toUpperCase();
        Optional<Group> opt = groupRepository.findByInviteCode(cleanCode);
        if (opt.isEmpty()) {
            return Optional.empty();
        }

        Group group = opt.get();

        boolean alreadyMember = group.getMembers().stream()
                .anyMatch(m -> m.getId() != null && m.getId().equals(request.getUserId()));

        if (!alreadyMember) {
            GroupMember newMember = GroupMember.builder()
                    .id(request.getUserId())
                    .name(request.getUserName() != null ? request.getUserName() : "Traveler")
                    .avatar(request.getAvatar() != null ? request.getAvatar() : "🎒")
                    .profileImage(request.getProfileImage())
                    .role("member")
                    .color(request.getColor() != null ? request.getColor() : "#10b981")
                    .build();
            newMember.setGroup(group);
            group.getMembers().add(newMember);
            groupRepository.save(group);
        }

        return Optional.of(group);
    }

    /** Errore di una regola sui membri del gruppo, con lo status HTTP da restituire. */
    public static class GroupRuleException extends RuntimeException {
        private final int status;
        public GroupRuleException(int status, String message) {
            super(message);
            this.status = status;
        }
        public int getStatus() { return status; }
    }

    public static final String ROLE_ADMIN = "admin";
    public static final String ROLE_MEMBER = "member";
    public static final String LAST_ADMIN_MESSAGE =
            "Sei l'unico amministratore del gruppo: nomina prima un altro amministratore";

    /** Esito dell'uscita/rimozione: il gruppo aggiornato, oppure {@code groupDeleted} se era l'ultimo membro. */
    public record RemoveMemberResult(Group group, boolean groupDeleted) {}

    private static boolean isAdminRole(GroupMember m) {
        return ROLE_ADMIN.equalsIgnoreCase(m.getRole());
    }

    private static GroupMember findMember(Group group, String memberId) {
        return group.getMembers().stream()
                .filter(m -> m.getId() != null && m.getId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new GroupRuleException(404, "Membro non trovato nel gruppo"));
    }

    /**
     * Rimuove un membro (o l'utente esce). Regole:
     * - se esce l'ultimo membro il gruppo viene eliminato (con i suoi viaggi);
     * - l'ultimo admin non può uscire finché restano altri membri (409): un gruppo con membri ha sempre un admin.
     */
    @Transactional
    public Optional<RemoveMemberResult> removeMember(String groupId, String memberId) {
        Optional<Group> opt = groupRepository.findById(groupId);
        if (opt.isEmpty()) return Optional.empty();
        Group group = opt.get();
        GroupMember target = findMember(group, memberId);
        List<GroupMember> others = group.getMembers().stream().filter(m -> m != target).toList();
        if (others.isEmpty()) {
            deleteGroup(groupId);
            return Optional.of(new RemoveMemberResult(null, true));
        }
        if (isAdminRole(target) && others.stream().noneMatch(GroupService::isAdminRole)) {
            throw new GroupRuleException(409, LAST_ADMIN_MESSAGE);
        }
        group.getMembers().remove(target);
        group.getMutedBy().remove(memberId);
        return Optional.of(new RemoveMemberResult(groupRepository.save(group), false));
    }

    /**
     * Cambia il ruolo di un membro. Ruoli ammessi: {@code admin} e {@code member} (400 altrimenti).
     * L'ultimo admin non può declassarsi (409).
     */
    @Transactional
    public Optional<Group> updateMemberRole(String groupId, String memberId, String role) {
        String normalized = role == null ? "" : role.trim().toLowerCase();
        if (!ROLE_ADMIN.equals(normalized) && !ROLE_MEMBER.equals(normalized)) {
            throw new GroupRuleException(400, "Ruolo non valido: usa \"admin\" o \"member\"");
        }
        Optional<Group> opt = groupRepository.findById(groupId);
        if (opt.isEmpty()) return Optional.empty();
        Group group = opt.get();
        GroupMember target = findMember(group, memberId);
        if (ROLE_MEMBER.equals(normalized) && isAdminRole(target)
                && group.getMembers().stream().filter(m -> m != target).noneMatch(GroupService::isAdminRole)) {
            throw new GroupRuleException(409, LAST_ADMIN_MESSAGE);
        }
        target.setRole(normalized);
        return Optional.of(groupRepository.save(group));
    }

    /**
     * Silenzia/riattiva il gruppo per un solo utente. {@code muted} null = inverte lo stato attuale,
     * altrimenti imposta lo stato richiesto (idempotente).
     */
    @Transactional
    public Optional<Group> setGroupMuted(String groupId, String userId, Boolean muted) {
        return groupRepository.findById(groupId).map(group -> {
            boolean target = muted != null ? muted : !group.getMutedBy().contains(userId);
            group.getMutedBy().remove(userId);
            if (target) {
                group.getMutedBy().add(userId);
            }
            return groupRepository.save(group);
        });
    }
}
