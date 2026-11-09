package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Preferenze delle notifiche push di un utente, per categoria (#97). Senza riga valgono i default. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "push_preferences")
public class PushPreferences {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Builder.Default
    @Column(nullable = false)
    private boolean invites = true;

    @Builder.Default
    @Column(nullable = false)
    private boolean proposals = true;

    @Builder.Default
    @Column(name = "new_members", nullable = false)
    private boolean newMembers = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean reminders = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Valori predefiniti per chi non ha mai cambiato le preferenze. */
    public static PushPreferences defaults(String userId) {
        return PushPreferences.builder().userId(userId).updatedAt(Instant.now()).build();
    }

    public boolean allows(PushCategory category) {
        return switch (category) {
            case INVITES -> invites;
            case PROPOSALS -> proposals;
            case NEW_MEMBERS -> newMembers;
            case REMINDERS -> reminders;
        };
    }
}
