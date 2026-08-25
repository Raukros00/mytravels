package com.example.tripplanner.controller;

import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.JoinGroupRequest;
import com.example.tripplanner.dto.UpdateGroupRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ResponseEntity<Group> createGroup(@Valid @RequestBody CreateGroupRequest request, Authentication authentication) {
        String currentUserId = authentication != null ? authentication.getName() : null;
        Group created = groupService.createGroup(request, currentUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<Group>> getAllGroups() {
        return ResponseEntity.ok(groupService.getAllGroups());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Group> getGroupById(@PathVariable String id) {
        Optional<Group> groupOpt = groupService.getGroup(id);
        return groupOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Group>> getGroupsByUser(@PathVariable String userId) {
        return ResponseEntity.ok(groupService.getGroupsByUser(userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Group> updateGroup(@PathVariable String id, @RequestBody UpdateGroupRequest request) {
        Optional<Group> updated = groupService.updateGroup(id, request);
        return updated.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable String id) {
        boolean deleted = groupService.deleteGroup(id);
        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "Group deleted successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@Valid @RequestBody JoinGroupRequest request) {
        Optional<Group> groupOpt = groupService.joinGroupByInvite(request);
        if (groupOpt.isPresent()) {
            return ResponseEntity.ok(groupOpt.get());
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid invite code or group not found"));
    }

    @DeleteMapping("/{groupId}/members/{memberId}")
    public ResponseEntity<?> removeMember(@PathVariable String groupId, @PathVariable String memberId) {
        Optional<Group> groupOpt = groupService.removeMember(groupId, memberId);
        return groupOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
