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

    /** 'group_invite' */
    private String type;

    @Column(name = "recipient_id", nullable = false)
    private String recipientId;

    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "group_id")
    private String groupId;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "group_icon")
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
