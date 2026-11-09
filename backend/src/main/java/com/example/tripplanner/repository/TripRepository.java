package com.example.tripplanner.repository;

import com.example.tripplanner.model.Trip;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, String> {

    List<Trip> findByGroupId(String groupId);

    List<Trip> findByGroupIdIn(java.util.Collection<String> groupIds);

    /** Viaggi con la decisione e la data di partenza indicate (promemoria prima della partenza). */
    List<Trip> findByDecisionAndStartDate(String decision, String startDate);

    /** #110: viaggi in corso in una data (`yyyy-MM-dd`: il confronto tra stringhe segue le date). */
    List<Trip> findByDecisionAndStartDateLessThanEqualAndEndDateGreaterThanEqual(String decision, String startDate, String endDate);

    /**
     * Il viaggio con la riga bloccata fino alla fine della transazione (SELECT ... FOR UPDATE):
     * le operazioni che leggono e riscrivono lo stesso viaggio (es. i voti) vengono eseguite
     * una dopo l'altra, così nessuna lavora su una copia superata.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Trip t where t.id = :id")
    Optional<Trip> findByIdForUpdate(@Param("id") String id);

    @Modifying
    @Query("delete from Trip t where t.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") String groupId);
}
