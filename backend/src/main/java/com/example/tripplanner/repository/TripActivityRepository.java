package com.example.tripplanner.repository;

import com.example.tripplanner.model.TripActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripActivityRepository extends JpaRepository<TripActivity, String> {
}
