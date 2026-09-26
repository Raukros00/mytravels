package com.example.tripplanner.repository;

import com.example.tripplanner.model.TripPlaceToEat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripPlaceToEatRepository extends JpaRepository<TripPlaceToEat, String> {
}
