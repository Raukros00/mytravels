package com.example.tripplanner.service;

import com.example.tripplanner.dto.JoinGroupRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupJoinRequest;
import com.example.tripplanner.model.Notification;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupJoinRequestRepository;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.NotificationRepository;
import com.example.tripplanner.security.GroupAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Accesso ai gruppi tramite link o codice invito: chi ha il codice vede un'anteprima del gruppo
 * e invia una richiesta; un admin la approva (l'utente entra come membro) o la rifiuta.
 */
@Service
public class JoinRequestService {

    /** Esito di una richiesta che non si può soddisfare (codice errato, già membro, già decisa...). */
    public static class JoinRequestException extends RuntimeException {
        private final int status;
        public JoinRequestException(int status, String message) {
            super(message);
            this.status = status;
        }
        public int getStatus() { return status; }
    }

    private final GroupRepository groupRepository;
    private final GroupJoinRequestRepository requestRepository;
    private final NotificationRepository notificationRepository;
    private final GroupService groupService;

    public JoinRequestService(GroupRepository groupRepository,
                              GroupJoinRequestRepository requestRepository,
                              NotificationRepository notificationRepository,
                              GroupService groupService) {
        this.groupRepository = groupRepository;
        this.requestRepository = requestRepository;
        this.notificationRepository = notificationRepository;
        this.groupService = groupService;
    }

    /** Anteprima del gruppo per chi ha il codice: niente membri né codice, solo ciò che serve a decidere. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(String inviteCode, User me) {
        Group group = findByCode(inviteCode);
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("id", group.getId());
        preview.put("name", group.getName());
        preview.put("description", group.getDescription());
        preview.put("icon", group.getIcon());
        preview.put("color", group.getColor());
        preview.put("memberCount", group.getMembers().size());
        boolean member = GroupAccess.isMember(group, me.getId());
        preview.put("isMember", member);
        Optional<GroupJoinRequest> last = requestRepository.findFirstByGroupIdAndUserIdOrderByCreatedAtDesc(group.getId(), me.getId());
        // Una richiesta rifiutata si può ripetere: la mostriamo, ma non blocca.
        preview.put("requestStatus", member ? null : last.map(GroupJoinRequest::getStatus).orElse(null));
        return preview;
    }

    /** Invia (o restituisce, se già in attesa) la richiesta di accesso e avvisa gli admin. */
    @Transactional
    public GroupJoinRequest request(String inviteCode, User me) {
        Group group = findByCode(inviteCode);
        if (GroupAccess.isMember(group, me.getId())) {
            throw new JoinRequestException(409, "Sei già membro di questo gruppo.");
        }
        Optional<GroupJoinRequest> pending =
                requestRepository.findFirstByGroupIdAndUserIdAndStatus(group.getId(), me.getId(), GroupJoinRequest.PENDING);
        if (pending.isPresent()) return pending.get();

        GroupJoinRequest request = requestRepository.save(GroupJoinRequest.builder()
                .id("jr_" + UUID.randomUUID())
                .groupId(group.getId())
                .userId(me.getId())
                .userName(me.getName())
                .avatar(me.getAvatar())
                .color(me.getColor())
                .profileImage(me.getProfileImage())
                .status(GroupJoinRequest.PENDING)
                .createdAt(Instant.now().toString())
                .build());

        group.getMembers().stream()
                .filter(m -> "admin".equalsIgnoreCase(m.getRole()))
                .forEach(admin -> notify("join_request", admin.getId(), me, group, request.getId(), "pending"));
        return request;
    }

    @Transactional(readOnly = true)
    public List<GroupJoinRequest> pending(String groupId) {
        return requestRepository.findByGroupIdAndStatusOrderByCreatedAtAsc(groupId, GroupJoinRequest.PENDING);
    }

    /** Approva o rifiuta (chi chiama deve essere admin: lo verifica il controller). */
    @Transactional
    public GroupJoinRequest decide(String groupId, String requestId, boolean approve, User admin) {
        GroupJoinRequest request = requestRepository.findById(requestId)
                .filter(r -> r.getGroupId().equals(groupId))
                .orElseThrow(() -> new JoinRequestException(404, "Richiesta non trovata."));
        if (!GroupJoinRequest.PENDING.equals(request.getStatus())) {
            throw new JoinRequestException(409, "La richiesta è già stata gestita.");
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new JoinRequestException(404, "Gruppo non trovato."));

        if (approve) {
            JoinGroupRequest join = new JoinGroupRequest();
            join.setInviteCode(group.getInviteCode());
            join.setUserId(request.getUserId());
            join.setUserName(request.getUserName());
            join.setAvatar(request.getAvatar());
            join.setColor(request.getColor());
            groupService.joinGroupByInvite(join);
        }
        request.setStatus(approve ? GroupJoinRequest.APPROVED : GroupJoinRequest.DECLINED);
        request.setDecidedAt(Instant.now().toString());
        request.setDecidedBy(admin.getId());
        requestRepository.save(request);

        // Le notifiche agli admin sulla stessa richiesta non sono più da gestire.
        notificationRepository.findByRequestId(requestId).forEach(n -> {
            n.setStatus(request.getStatus());
            notificationRepository.save(n);
        });
        notify(approve ? "join_approved" : "join_declined", request.getUserId(), admin, group, requestId, request.getStatus());
        return request;
    }

    private Group findByCode(String inviteCode) {
        String code = inviteCode == null ? "" : inviteCode.trim().toUpperCase();
        return groupRepository.findByInviteCode(code)
                .orElseThrow(() -> new JoinRequestException(404, "Link o codice invito non valido."));
    }

    private void notify(String type, String recipientId, User sender, Group group, String requestId, String status) {
        notificationRepository.save(Notification.builder()
                .id("notif_" + UUID.randomUUID().toString().substring(0, 8))
                .type(type)
                .recipientId(recipientId)
                .senderId(sender.getId())
                .senderName(sender.getName())
                .groupId(group.getId())
                .groupName(group.getName())
                .groupIcon(group.getIcon())
                .groupColor(group.getColor())
                .requestId(requestId)
                .createdAt(Instant.now().toString())
                .read(false)
                .status(status)
                .build());
    }
}
