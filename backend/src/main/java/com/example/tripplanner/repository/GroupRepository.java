package com.example.tripplanner.repository;

import com.example.tripplanner.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends JpaRepository<Group, String> {

    Optional<Group> findByInviteCode(String inviteCode);

    /**
     * Returns all groups where the user is the creator OR is a member.
     * Replaces the Mongo $or query against creatorId and members.id.
     * Uses DISTINCT to avoid duplicates when a user is both creator and member.
     */
    @Query("select distinct g from Group g left join g.members m " +
           "where g.creatorId = :userId or m.id = :userId")
    List<Group> findByUserId(@Param("userId") String userId);
}
