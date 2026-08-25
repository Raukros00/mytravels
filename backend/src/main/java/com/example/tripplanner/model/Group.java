package com.example.tripplanner.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "groups")
public class Group {
    @Id
    private String id;
    private String name;
    private String description;
    private String icon;
    private String color;
    private String creatorId;
    
    @Indexed(unique = true)
    private String inviteCode;
    
    @Builder.Default
    private String createdAt = Instant.now().toString();
    
    @Builder.Default
    private List<GroupMember> members = new ArrayList<>();
}
