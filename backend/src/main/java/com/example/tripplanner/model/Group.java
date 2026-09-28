package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "groups",
       uniqueConstraints = @UniqueConstraint(columnNames = "invite_code"))
public class Group implements Persistable<String> {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String icon;
    private String color;

    /** Soft reference to the creator User id — FK enforced only at DDL level to keep JSON as a plain string. */
    @Column(name = "creator_id")
    private String creatorId;

    @Column(name = "invite_code", nullable = false, unique = true)
    private String inviteCode;

    @Column(name = "created_at")
    private String createdAt;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<GroupMember> members = new ArrayList<>();

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }
}
