package com.example.tripplanner.repository;

import com.example.tripplanner.model.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findByGroupId(String groupId);

    @Modifying
    @Query("delete from Trip t where t.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") String groupId);
}
