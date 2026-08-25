package com.example.tripplanner.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class JoinGroupRequest {
    @NotBlank
    private String inviteCode;
    private String userId;
    private String userName;
    private String avatar;
    private String color;
}
