package com.example.tripplanner.controller;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupJoinRequest;
import com.example.tripplanner.model.User;
import com.example.tripplanner.ratelimit.RateLimits;
import com.example.tripplanner.security.GroupAccess;
import com.example.tripplanner.service.JoinRequestService;
import com.example.tripplanner.service.JoinRequestService.JoinRequestException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Inviti tramite link/codice: anteprima del gruppo, richiesta di accesso, approvazione da parte di un admin.
 * Il link invito è /join/{codice}: il codice è il segreto condiviso.
 */
@RestController
@RequestMapping("/api/v1/groups")
public class JoinRequestController {

    private final JoinRequestService joinRequestService;
    private final GroupAccess groupAccess;
    private final RateLimits rateLimits;

    public JoinRequestController(JoinRequestService joinRequestService, GroupAccess groupAccess, RateLimits rateLimits) {
        this.joinRequestService = joinRequestService;
        this.groupAccess = groupAccess;
        this.rateLimits = rateLimits;
    }

    /** Anteprima del gruppo dal codice invito; limitata per IP contro la ricerca a tappeto dei codici (#83). */
    @GetMapping("/invite/{code}")
    public ResponseEntity<?> preview(@PathVariable String code, Authentication authentication, HttpServletRequest request) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        String ip = RateLimits.clientIp(request);
        long wait = rateLimits.invitePreviewByIp.retryAfterSeconds(ip);
        if (wait > 0) return RateLimits.tooManyRequests(wait);
        rateLimits.invitePreviewByIp.record(ip);
        return ResponseEntity.ok(joinRequestService.preview(code, me.get()));
    }

    @PostMapping("/invite/{code}/request")
    public ResponseEntity<?> request(@PathVariable String code, Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.status(HttpStatus.CREATED).body(joinRequestService.request(code, me.get()));
    }

    /** Richieste in attesa: solo per gli admin del gruppo. */
    @GetMapping("/{groupId}/join-requests")
    public ResponseEntity<List<GroupJoinRequest>> pending(@PathVariable String groupId, Authentication authentication) {
        if (groupAccess.adminGroup(groupId, authentication).isEmpty()) return forbiddenOrNotFound(groupId, authentication);
        return ResponseEntity.ok(joinRequestService.pending(groupId));
    }

    @PostMapping("/{groupId}/join-requests/{requestId}/approve")
    public ResponseEntity<?> approve(@PathVariable String groupId, @PathVariable String requestId, Authentication authentication) {
        return decide(groupId, requestId, true, authentication);
    }

    @PostMapping("/{groupId}/join-requests/{requestId}/decline")
    public ResponseEntity<?> decline(@PathVariable String groupId, @PathVariable String requestId, Authentication authentication) {
        return decide(groupId, requestId, false, authentication);
    }

    private ResponseEntity<?> decide(String groupId, String requestId, boolean approve, Authentication authentication) {
        Optional<User> me = groupAccess.currentUser(authentication);
        if (me.isEmpty() || groupAccess.adminGroup(groupId, authentication).isEmpty()) {
            return forbiddenOrNotFound(groupId, authentication);
        }
        return ResponseEntity.ok(joinRequestService.decide(groupId, requestId, approve, me.get()));
    }

    /** 404 per chi non è membro (non rivela il gruppo), 403 per un membro non admin. */
    private <T> ResponseEntity<T> forbiddenOrNotFound(String groupId, Authentication authentication) {
        Optional<Group> member = groupAccess.memberGroup(groupId, authentication);
        return ResponseEntity.status(member.isPresent() ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND).build();
    }

    @ExceptionHandler(JoinRequestException.class)
    public ResponseEntity<Map<String, String>> handle(JoinRequestException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("message", e.getMessage()));
    }
}
