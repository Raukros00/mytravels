package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Abbonamento Web Push di un dispositivo (browser o PWA installata) di un utente. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "push_subscriptions")
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    /** URL del push service del browser (FCM, Mozilla, Apple...): identifica il dispositivo. */
    @Column(nullable = false, unique = true, length = 2048)
    private String endpoint;

    /** Chiave pubblica ECDH P-256 del browser (base64url). */
    @Column(nullable = false)
    private String p256dh;

    /** Segreto di autenticazione del browser (base64url). */
    @Column(nullable = false)
    private String auth;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    /** Lingua dell'app sul dispositivo ('it', 'en'), per i testi delle notifiche. */
    @Column(length = 10)
    private String lang;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
