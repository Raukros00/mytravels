package com.example.tripplanner.dto;

import lombok.Data;

@Data
public class UpdateGroupRequest {
    private String name;
    private String description;
    private String icon;
    private String color;
}
