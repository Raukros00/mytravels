package com.example.tripplanner.dto;

import lombok.Data;

/**
 * Modifica del gruppo (solo admin). Le notifiche silenziate non si cambiano da qui:
 * ognuno gestisce le proprie con {@code POST /api/v1/groups/{id}/mute}.
 */
@Data
public class UpdateGroupRequest {
    private String name;
    private String description;
    private String icon;
    private String color;
    private String currency;
    private Boolean archived;
}
