package com.example.tripplanner.repository;

import com.example.tripplanner.model.Group;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends MongoRepository<Group, String> {
    Optional<Group> findByInviteCode(String inviteCode);
    
    @Query("{ '$or': [ { 'creatorId': ?0 }, { 'members.id': ?0 } ] }")
    List<Group> findByUserId(String userId);
}
