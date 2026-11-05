package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.time.LocalDate;

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

    /** Nome completo "Nome Cognome", usato nel resto dell'app (membri dei gruppi, notifiche...). */
    private String name;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    /** Foto profilo opzionale (data URL dell'immagine ritagliata). */
    @Column(name = "profile_image", columnDefinition = "text")
    private String profileImage;

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
