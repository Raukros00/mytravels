package com.example.tripplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "trip_activities")
public class TripActivity {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    /** Owning side of the FK — not serialized to avoid recursion. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false, insertable = false, updatable = false)
    @JsonIgnore
    private Trip trip;

    /** Scalar column so JSON still has "tripId". */
    @Column(name = "trip_id", nullable = false)
    private String tripId;

    private String name;

    /** 'monument' | 'museum' | 'nature' | 'experience' | 'shopping' | 'other' */
    private String category;

    @Column(columnDefinition = "text")
    private String address;

    @Embedded
    private GeoPoint coordinates;

    @Column(name = "tickets_required") private Boolean ticketsRequired;
    @Column(name = "ticket_price")     private Double ticketPrice;
    private String currency;
    @Column(name = "booking_required") private Boolean bookingRequired;
    @Column(name = "booking_url", columnDefinition = "text") private String bookingUrl;
    @Column(name = "opening_hours")    private String openingHours;
    @Column(name = "closing_days")     private String closingDays;
    @Column(columnDefinition = "text") private String notes;

    /** null = backlog, number = assigned to Day X */
    @Column(name = "assigned_day")  private Integer assignedDay;
    @Column(name = "time_slot")     private String timeSlot;
    @Column(name = "is_completed")  private Boolean isCompleted;

    /** Saltata durante il viaggio (#103): non fatta, da recuperare in un altro giorno (#112). */
    @Column(name = "is_skipped", nullable = false)
    @Builder.Default
    private Boolean isSkipped = false;

    /** Orari strutturati 'HH:mm' (facoltativi; la fine solo dopo l'inizio). {@code timeSlot} resta come testo libero. */
    @Column(name = "start_time") private String startTime;
    @Column(name = "end_time")   private String endTime;

    /** Posizione nella giornata decisa dall'utente; null = posizionata in base all'orario. */
    @Column(name = "day_order")  private Integer dayOrder;
}
