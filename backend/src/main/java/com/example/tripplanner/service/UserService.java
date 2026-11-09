package com.example.tripplanner.service;

import com.example.tripplanner.dto.UpdateProfileDto;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Operazioni dell'utente sul proprio account (Profilo, epica #113). */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final EntityManager em;

    public UserService(UserRepository userRepository, EntityManager em) {
        this.userRepository = userRepository;
        this.em = em;
    }

    /**
     * Aggiorna nome, cognome, data di nascita, foto e avatar dell'utente (#120).
     * <p>
     * Nome, avatar, colore e foto sono <b>copiati</b> in alcune tabelle (membri dei gruppi, richieste di
     * accesso in attesa, mittente delle notifiche): si aggiornano anche lì nella stessa transazione, così
     * il nuovo nome compare subito ovunque senza cambiare il formato delle API.
     */
    @Transactional
    public User updateProfile(User user, UpdateProfileDto dto) {
        String first = dto.getFirstName().trim();
        String last = dto.getLastName().trim();
        user.setFirstName(first);
        user.setLastName(last);
        user.setName(first + " " + last);
        user.setBirthDate(dto.getBirthDate());
        user.setProfileImage(dto.getProfileImage() == null || dto.getProfileImage().isBlank() ? null : dto.getProfileImage());
        if (dto.getAvatar() != null && !dto.getAvatar().isBlank()) user.setAvatar(dto.getAvatar().trim());
        if (dto.getColor() != null && !dto.getColor().isBlank()) user.setColor(dto.getColor().toLowerCase());
        User saved = userRepository.saveAndFlush(user);
        propagateProfile(saved);
        return saved;
    }

    /** Copia i dati pubblici dell'utente dove sono duplicati (vedi {@link #updateProfile}). */
    private void propagateProfile(User u) {
        em.createQuery("update GroupMember m set m.name = :name, m.avatar = :avatar, m.color = :color, "
                        + "m.profileImage = :image where m.id = :uid")
                .setParameter("name", u.getName())
                .setParameter("avatar", u.getAvatar())
                .setParameter("color", u.getColor())
                .setParameter("image", u.getProfileImage())
                .setParameter("uid", u.getId())
                .executeUpdate();
        // Solo le richieste in attesa: quelle già decise sono storico.
        em.createQuery("update GroupJoinRequest r set r.userName = :name, r.avatar = :avatar, r.color = :color, "
                        + "r.profileImage = :image where r.userId = :uid and r.status = 'pending'")
                .setParameter("name", u.getName())
                .setParameter("avatar", u.getAvatar())
                .setParameter("color", u.getColor())
                .setParameter("image", u.getProfileImage())
                .setParameter("uid", u.getId())
                .executeUpdate();
        em.createQuery("update Notification n set n.senderName = :name where n.senderId = :uid")
                .setParameter("name", u.getName())
                .setParameter("uid", u.getId())
                .executeUpdate();
    }
}
