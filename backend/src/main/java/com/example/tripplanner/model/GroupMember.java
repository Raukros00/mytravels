package com.example.tripplanner.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "group_members",
       uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"}))
public class GroupMember {

    /** Surrogate PK — internal only, never exposed in JSON. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonIgnore
    private Long rowId;

    /** The Group this membership belongs to — back-reference, not serialized. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    @JsonIgnore
    private Group group;

    /**
     * The user id — mapped to column user_id but exposed in JSON as "id"
     * so the frontend contract is preserved without any change.
     * Builder field name stays "id" so existing GroupMember.builder().id(...) calls compile.
     */
    @Column(name = "user_id", nullable = false)
    @JsonProperty("id")
    @EqualsAndHashCode.Include
    private String id;

    @Column(name = "member_name")
    @JsonProperty("name")
    private String name;

    private String avatar;

    /** "admin" or "member" */
    private String role;

    private String color;
}
