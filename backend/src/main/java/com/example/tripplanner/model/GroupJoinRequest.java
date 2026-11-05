package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

/** Richiesta di accesso a un gruppo, inviata da link o codice invito e decisa da un admin. */
@Entity
@Table(name = "group_join_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class GroupJoinRequest implements Persistable<String> {

    public static final String PENDING = "pending";
    public static final String APPROVED = "approved";
    public static final String DECLINED = "declined";

    @Id
    @EqualsAndHashCode.Include
    private String id;

    @Column(name = "group_id", nullable = false)
    private String groupId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_name")
    private String userName;

    private String avatar;
    private String color;

    @Column(name = "profile_image", columnDefinition = "text")
    private String profileImage;

    /** 'pending' | 'approved' | 'declined' */
    @Column(nullable = false)
    private String status;

    @Column(name = "created_at")
    private String createdAt;

    @Column(name = "decided_at")
    private String decidedAt;

    @Column(name = "decided_by")
    private String decidedBy;

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }
}
