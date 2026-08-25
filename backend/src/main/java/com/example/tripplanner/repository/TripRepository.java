package com.example.tripplanner.repository;

import com.example.tripplanner.model.Trip;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripRepository extends MongoRepository<Trip, String> {
    List<Trip> findByGroupId(String groupId);
    void deleteByGroupId(String groupId);
}
