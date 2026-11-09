package com.example.tripplanner.repository;

import com.example.tripplanner.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Id dell'utente con questa email esatta (controllo leggero del JWT a ogni richiesta, #121). */
    @Query("select u.id from User u where u.email = :email")
    Optional<String> findIdByEmail(@Param("email") String email);

    /** Esiste un account con questa email, ignorando maiuscole/minuscole e spazi (anche righe non normalizzate). */
    @Query("select count(u) > 0 from User u where lower(trim(u.email)) = lower(trim(:email))")
    boolean existsByEmailIgnoringCase(@Param("email") String email);

    /** Utenti il cui nome contiene `q`, oppure con email esattamente `q` (niente ricerca parziale sulle email). */
    @Query("select u from User u where lower(u.name) like lower(concat('%', :q, '%')) or lower(u.email) = lower(:q) order by u.name")
    List<User> search(@Param("q") String q, Pageable pageable);
}
