package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "notifications")
public class Notification implements Persistable<String> {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    /** 'group_invite' | 'join_request' | 'join_approved' | 'join_declined' */
    private String type;

    @Column(name = "recipient_id", nullable = false)
    private String recipientId;

    @Column(name = "sender_name")
    private String senderName;

    /** Utente che ha generato la notifica (chi invita o chi chiede di entrare). */
    @Column(name = "sender_id")
    private String senderId;

    /** Per le notifiche sulle richieste di accesso: id della GroupJoinRequest. */
    @Column(name = "request_id")
    private String requestId;

    @Column(name = "group_id")
    private String groupId;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "group_icon", columnDefinition = "text")
    private String groupIcon;

    @Column(name = "group_color")
    private String groupColor;

    @Column(name = "created_at")
    private String createdAt;

    @Builder.Default
    private Boolean read = false;

    /** 'pending' | 'accepted' | 'declined' */
    private String status;

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }
}
