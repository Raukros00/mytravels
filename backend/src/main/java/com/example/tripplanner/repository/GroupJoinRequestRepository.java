package com.example.tripplanner.repository;

import com.example.tripplanner.model.GroupJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, String> {
    List<GroupJoinRequest> findByGroupIdAndStatusOrderByCreatedAtAsc(String groupId, String status);
    Optional<GroupJoinRequest> findFirstByGroupIdAndUserIdAndStatus(String groupId, String userId, String status);
    Optional<GroupJoinRequest> findFirstByGroupIdAndUserIdOrderByCreatedAtDesc(String groupId, String userId);
}
