package com.example.tripplanner.repository;

import com.example.tripplanner.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(String recipientId);
    List<Notification> findByRequestId(String requestId);
    List<Notification> findByGroupIdAndTypeAndStatusOrderByCreatedAtDesc(String groupId, String type, String status);
    Optional<Notification> findFirstByTypeAndRecipientIdAndGroupIdAndStatus(String type, String recipientId, String groupId, String status);
}
