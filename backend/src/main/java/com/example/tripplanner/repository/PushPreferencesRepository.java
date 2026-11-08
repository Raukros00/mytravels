package com.example.tripplanner.repository;

import com.example.tripplanner.model.PushPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface PushPreferencesRepository extends JpaRepository<PushPreferences, String> {
    List<PushPreferences> findByUserIdIn(Collection<String> userIds);
}
