package com.example.tripplanner.controller;

import com.example.tripplanner.model.Notification;
import com.example.tripplanner.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<Notification>> getNotifications(
            @RequestParam(required = false) String recipientId,
            Authentication auth) {
        String targetUserId = recipientId != null && !recipientId.isBlank()
                ? recipientId
                : (auth != null ? auth.getName() : null);

        if (targetUserId == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        return ResponseEntity.ok(notificationService.getNotificationsForUser(targetUserId));
    }

    @PostMapping
    public ResponseEntity<Notification> createNotification(@RequestBody Notification notification) {
        Notification created = notificationService.createNotification(notification);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable String id) {
        Optional<Notification> updated = notificationService.markAsRead(id);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead(
            @RequestParam(required = false) String recipientId,
            Authentication auth) {
        String targetUserId = recipientId != null && !recipientId.isBlank()
                ? recipientId
                : (auth != null ? auth.getName() : null);

        if (targetUserId != null) {
            notificationService.markAllRead(targetUserId);
        }
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<Notification> acceptInvite(@PathVariable String id) {
        Optional<Notification> updated = notificationService.acceptInvite(id);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping("/{id}/decline")
    public ResponseEntity<Notification> declineInvite(@PathVariable String id) {
        Optional<Notification> updated = notificationService.declineInvite(id);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable String id) {
        boolean deleted = notificationService.deleteNotification(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Notification deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }
}
