package com.example.tripplanner.service;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.Notification;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.NotificationRepository;
import com.example.tripplanner.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               GroupRepository groupRepository,
                               UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
    }

    public List<Notification> getNotificationsForUser(String recipientId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId);
    }

    @Transactional
    public Notification createNotification(Notification notification) {
        if (notification.getId() == null || notification.getId().isBlank()) {
            notification.setId("notif_" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (notification.getCreatedAt() == null || notification.getCreatedAt().isBlank()) {
            notification.setCreatedAt(Instant.now().toString());
        }
        if (notification.getRead() == null) {
            notification.setRead(false);
        }
        if (notification.getStatus() == null) {
            notification.setStatus("pending");
        }
        return notificationRepository.save(notification);
    }

    @Transactional
    public Optional<Notification> markAsRead(String id) {
        return notificationRepository.findById(id).map(notif -> {
            notif.setRead(true);
            return notificationRepository.save(notif);
        });
    }

    @Transactional
    public void markAllRead(String recipientId) {
        List<Notification> list = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId);
        for (Notification n : list) {
            n.setRead(true);
        }
        notificationRepository.saveAll(list);
    }

    @Transactional
    public Optional<Notification> acceptInvite(String notificationId) {
        return notificationRepository.findById(notificationId).map(notif -> {
            if ("group_invite".equals(notif.getType()) && notif.getGroupId() != null) {
                Optional<Group> groupOpt = groupRepository.findById(notif.getGroupId());
                if (groupOpt.isPresent()) {
                    Group group = groupOpt.get();
                    boolean alreadyMember = group.getMembers().stream()
                            .anyMatch(m -> m.getId() != null && m.getId().equals(notif.getRecipientId()));
                    if (!alreadyMember) {
                        Optional<User> userOpt = userRepository.findById(notif.getRecipientId());
                        GroupMember newMember = GroupMember.builder()
                                .id(notif.getRecipientId())
                                .name(userOpt.map(User::getName).orElse("Traveler"))
                                .avatar(userOpt.map(User::getAvatar).orElse("🎒"))
                                .profileImage(userOpt.map(User::getProfileImage).orElse(null))
                                .role("member")
                                .color(userOpt.map(User::getColor).orElse("#10b981"))
                                .build();
                        newMember.setGroup(group);
                        group.getMembers().add(newMember);
                        groupRepository.save(group);
                    }
                }
            }
            notif.setStatus("accepted");
            notif.setRead(true);
            return notificationRepository.save(notif);
        });
    }

    @Transactional
    public Optional<Notification> declineInvite(String notificationId) {
        return notificationRepository.findById(notificationId).map(notif -> {
            notif.setStatus("declined");
            notif.setRead(true);
            return notificationRepository.save(notif);
        });
    }

    @Transactional
    public boolean deleteNotification(String id) {
        if (notificationRepository.existsById(id)) {
            notificationRepository.deleteById(id);
            return true;
        }
        return false;
    }
}
