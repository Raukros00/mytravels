package com.example.tripplanner.repository;

import com.example.tripplanner.model.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUserIdOrderByCreatedAtDesc(String userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Modifying
    @Transactional
    @Query("delete from PushSubscription s where s.endpoint = :endpoint and s.userId = :userId")
    int deleteOwn(String endpoint, String userId);

    @Modifying
    @Transactional
    @Query("delete from PushSubscription s where s.id = :id")
    int deleteId(Long id);

    @Modifying
    @Transactional
    @Query("update PushSubscription s set s.lastUsedAt = :at where s.id = :id")
    int touch(Long id, Instant at);
}
