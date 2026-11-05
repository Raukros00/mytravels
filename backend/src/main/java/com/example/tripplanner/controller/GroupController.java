package com.example.tripplanner.controller;

import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.UpdateGroupRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.User;
import com.example.tripplanner.service.AuthService;
import com.example.tripplanner.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Gruppi visibili e modificabili solo da chi ne fa parte.
 * L'utente è sempre quello del JWT (il principal è l'email), mai un id passato dal client.
 * Un gruppo di cui non si è membri risponde 404, così non se ne rivela l'esistenza.
 */
@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;
    private final AuthService authService;

    public GroupController(GroupService groupService, AuthService authService) {
        this.groupService = groupService;
        this.authService = authService;
    }

    @PostMapping
    public ResponseEntity<Group> createGroup(@Valid @RequestBody CreateGroupRequest request, Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        request.setCreatorId(me.get().getId());
        Group created = groupService.createGroup(request, me.get().getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** Solo i gruppi di cui l'utente è membro. */
    @GetMapping
    public ResponseEntity<List<Group>> getMyGroups(Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String userId = me.get().getId();
        return ResponseEntity.ok(groupService.getGroupsByUser(userId).stream().filter(g -> isMember(g, userId)).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Group> getGroupById(@PathVariable String id, Authentication authentication) {
        return memberGroup(id, authentication)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    /** Ammesso solo per sé stessi: i gruppi degli altri utenti non sono consultabili. */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Group>> getGroupsByUser(@PathVariable String userId, Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!me.get().getId().equals(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        return ResponseEntity.ok(groupService.getGroupsByUser(userId).stream().filter(g -> isMember(g, userId)).toList());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Group> updateGroup(@PathVariable String id, @RequestBody UpdateGroupRequest request,
                                             Authentication authentication) {
        if (memberGroup(id, authentication).isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Optional<Group> updated = groupService.updateGroup(id, request);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable String id, Authentication authentication) {
        ResponseEntity<?> denied = requireAdmin(id, authentication);
        if (denied != null) return denied;
        boolean deleted = groupService.deleteGroup(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Group deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    // L'ingresso con codice/link passa da una richiesta approvata da un admin: vedi JoinRequestController.

    /** Un admin può rimuovere chiunque; un membro può rimuovere solo sé stesso (lasciare il gruppo). */
    @DeleteMapping("/{groupId}/members/{memberId}")
    public ResponseEntity<?> removeMember(@PathVariable String groupId, @PathVariable String memberId,
                                          Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        boolean isSelf = me.get().getId().equals(memberId);
        ResponseEntity<?> denied = isSelf ? requireMember(groupId, authentication) : requireAdmin(groupId, authentication);
        if (denied != null) return denied;

        Optional<Group> groupOpt = groupService.removeMember(groupId, memberId);
        return groupOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{groupId}/members/{memberId}/role")
    public ResponseEntity<?> updateMemberRole(@PathVariable String groupId,
                                              @PathVariable String memberId,
                                              @RequestBody Map<String, String> body,
                                              Authentication authentication) {
        ResponseEntity<?> denied = requireAdmin(groupId, authentication);
        if (denied != null) return denied;
        String role = body.get("role");
        if (role == null || role.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Role is required"));
        }
        Optional<Group> groupOpt = groupService.updateMemberRole(groupId, memberId, role);
        return groupOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    /** Silenzia/riattiva il gruppo per l'utente autenticato. */
    @PostMapping("/{groupId}/mute")
    public ResponseEntity<?> toggleMuteGroup(@PathVariable String groupId, Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (memberGroup(groupId, authentication).isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        Optional<Group> groupOpt = groupService.toggleMuteGroup(groupId, me.get().getId());
        return groupOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    // ── Autorizzazione ────────────────────────────────────────────────────────

    private Optional<User> currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return Optional.empty();
        return authService.findByEmail(authentication.getName());
    }

    /** Il gruppo, solo se l'utente autenticato ne è membro. */
    private Optional<Group> memberGroup(String groupId, Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        if (me.isEmpty()) return Optional.empty();
        String userId = me.get().getId();
        return groupService.getGroup(groupId).filter(g -> isMember(g, userId));
    }

    private ResponseEntity<?> requireMember(String groupId, Authentication authentication) {
        return memberGroup(groupId, authentication).isPresent() ? null : ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    private ResponseEntity<?> requireAdmin(String groupId, Authentication authentication) {
        Optional<User> me = currentUser(authentication);
        Optional<Group> group = memberGroup(groupId, authentication);
        if (me.isEmpty() || group.isEmpty()) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        String userId = me.get().getId();
        boolean admin = group.get().getMembers().stream()
                .anyMatch(m -> userId.equals(m.getId()) && "admin".equalsIgnoreCase(m.getRole()));
        return admin ? null : ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Only group admins can do this"));
    }

    /** Membro = presente nella lista membri (il creatore che ha lasciato il gruppo non lo è più). */
    private static boolean isMember(Group group, String userId) {
        return group.getMembers().stream().anyMatch(m -> userId.equals(m.getId()));
    }
}
