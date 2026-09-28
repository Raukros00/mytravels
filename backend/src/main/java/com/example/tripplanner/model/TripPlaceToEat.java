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
@Table(name = "trip_places_to_eat")
public class TripPlaceToEat {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    /** Owning side of the FK — not serialized. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false, insertable = false, updatable = false)
    @JsonIgnore
    private Trip trip;

    /** Scalar column so JSON still has "tripId". */
    @Column(name = "trip_id", nullable = false)
    private String tripId;

    private String name;

    /** 'lunch' | 'dinner' | 'snack' | 'breakfast' | 'aperitivo' */
    private String category;

    /** '€' | '€€' | '€€€' | '€€€€' */
    @Column(name = "price_range") private String priceRange;

    @Column(columnDefinition = "text")
    private String address;

    @Embedded
    private GeoPoint coordinates;

    @Column(columnDefinition = "text") private String specialties;
    @Column(name = "booking_required") private Boolean bookingRequired;
    @Column(name = "opening_hours")    private String openingHours;
    @Column(name = "closing_days")     private String closingDays;
    @Column(columnDefinition = "text") private String notes;
    @Column(name = "assigned_day")     private Integer assignedDay;
    @Column(name = "assigned_meal")    private String assignedMeal;
    @Column(name = "time_slot")        private String timeSlot;
    @Column(name = "is_visited")       private Boolean isVisited;
}
