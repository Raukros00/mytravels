package com.example.tripplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import lombok.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "trip_expenses")
public class TripExpense {

    @Id
    @EqualsAndHashCode.Include
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false, insertable = false, updatable = false)
    @JsonIgnore
    private Trip trip;

    @Column(name = "trip_id", nullable = false)
    private String tripId;

    private String title;

    @Column(nullable = false)
    private Double amount;

    private String category;

    private String date;

    @Column(name = "paid_by")
    private String paidBy;

    @ElementCollection(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @CollectionTable(name = "trip_expense_split_among", joinColumns = @JoinColumn(name = "expense_id"))
    @Column(name = "member_id")
    @Builder.Default
    private List<String> splitAmong = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @Fetch(FetchMode.SUBSELECT)
    @CollectionTable(name = "trip_expense_shares", joinColumns = @JoinColumn(name = "expense_id"))
    @MapKeyColumn(name = "member_id")
    @Column(name = "share_amount")
    @Builder.Default
    private Map<String, Double> shares = new HashMap<>();

    private String type;

    @Column(columnDefinition = "text")
    private String notes;
}
