package com.example.tripplanner.model;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "trips")
public class Trip implements Persistable<String> {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    /** Soft reference to Group — FK enforced at DDL level; kept as scalar to preserve JSON "groupId". */
    @Column(name = "group_id", nullable = false)
    private String groupId;

    private String title;
    private String destination;
    private String country;

    @Column(name = "start_date") private String startDate;
    @Column(name = "end_date")   private String endDate;
    @Column(name = "cover_url", columnDefinition = "text") private String coverUrl;

    /** 'planning' | 'upcoming' | 'ongoing' | 'completed' */
    private String status;

    @Column(name = "budget_estimate") private Double budgetEstimate;
    private String currency;

    @ElementCollection
    @CollectionTable(name = "trip_tags", joinColumns = @JoinColumn(name = "trip_id"))
    @OrderColumn(name = "tag_order")
    @Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Column(columnDefinition = "text") private String notes;
    @Column(name = "created_at")       private String createdAt;

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TripActivity> activities = new ArrayList<>();

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TripPlaceToEat> placesToEat = new ArrayList<>();

    @Embedded
    private FlightDetails flights;

    @Embedded
    private AirportTransfer transfers;

    @Embedded
    private AccommodationDetails accommodation;

    @Transient
    @Builder.Default
    private boolean isNew = true;

    @Override
    public boolean isNew() { return isNew; }

    @PostLoad
    @PostPersist
    void markNotNew() { this.isNew = false; }
}
