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
@Table(name = "users",
       uniqueConstraints = @UniqueConstraint(columnNames = "email"))
public class User implements Persistable<String> {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    private String password;
    private String avatar;
    private String color;

    /** "USER" or "ADMIN" */
    private String role;

    @Column(name = "joined_date")
    private String joinedDate;

    /**
     * Tracks whether this instance has never been persisted.
     * Needed because Hibernate issues a SELECT before INSERT for app-assigned PKs
     * unless the entity implements Persistable correctly.
     */
    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }
}
