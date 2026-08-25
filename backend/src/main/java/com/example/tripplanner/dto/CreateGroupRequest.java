package com.example.tripplanner.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateGroupRequest {
    @NotBlank
    private String name;
    private String description;
    private String icon;
    private String color;
    private String creatorId;
}
