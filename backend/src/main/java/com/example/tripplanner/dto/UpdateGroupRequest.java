package com.example.tripplanner.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateGroupRequest {
    private String name;
    private String description;
    private String icon;
    private String color;
    private String currency;
    private Boolean archived;
    private List<String> mutedBy;
}
