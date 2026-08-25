package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {
    private String id; // user id
    private String name;
    private String avatar;
    private String role; // "admin" or "member"
    private String color;
}
