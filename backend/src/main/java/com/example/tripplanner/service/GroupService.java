package com.example.tripplanner.service;

import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.JoinGroupRequest;
import com.example.tripplanner.dto.UpdateGroupRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.GroupMember;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final TripRepository tripRepository;

    public GroupService(GroupRepository groupRepository, UserRepository userRepository, TripRepository tripRepository) {
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.tripRepository = tripRepository;
    }

    @Transactional
    public Group createGroup(CreateGroupRequest request, String defaultUserId) {
        String creatorId = request.getCreatorId() != null && !request.getCreatorId().isBlank()
                ? request.getCreatorId()
                : defaultUserId;

        String inviteCode = "GRP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 5).toUpperCase();

        Group group = Group.builder()
                .id(UUID.randomUUID().toString())
                .name(request.getName().trim())
                .description(request.getDescription() != null ? request.getDescription().trim() : "")
                .icon(request.getIcon() != null && !request.getIcon().isBlank() ? request.getIcon() : "✈️")
                .color(request.getColor() != null && !request.getColor().isBlank() ? request.getColor() : "#4f46e5")
                .creatorId(creatorId)
                .inviteCode(inviteCode)
                .createdAt(Instant.now().toString().split("T")[0])
                .members(new ArrayList<>())
                .build();

        if (creatorId != null) {
            Optional<User> creatorOpt = userRepository.findById(creatorId);
            if (creatorOpt.isEmpty()) {
                creatorOpt = userRepository.findByEmail(creatorId);
            }
            GroupMember member;
            if (creatorOpt.isPresent()) {
                User u = creatorOpt.get();
                member = GroupMember.builder()
                        .id(u.getId())
                        .name(u.getName())
                        .avatar(u.getAvatar())
                        .role("admin")
                        .color(u.getColor())
                        .build();
            } else {
                member = GroupMember.builder()
                        .id(creatorId)
                        .name("Admin")
                        .avatar("👑")
                        .role("admin")
                        .color(request.getColor() != null ? request.getColor() : "#4f46e5")
                        .build();
            }
            member.setGroup(group);
            group.getMembers().add(member);
        }

        return groupRepository.save(group);
    }

    public Optional<Group> getGroup(String id) {
        return groupRepository.findById(id);
    }

    public List<Group> getAllGroups() {
        return groupRepository.findAll();
    }

    public List<Group> getGroupsByUser(String userId) {
        return groupRepository.findByUserId(userId);
    }

    @Transactional
    public Optional<Group> updateGroup(String id, UpdateGroupRequest request) {
        return groupRepository.findById(id).map(existing -> {
            if (request.getName() != null && !request.getName().isBlank()) {
                existing.setName(request.getName().trim());
            }
            if (request.getDescription() != null) {
                existing.setDescription(request.getDescription().trim());
            }
            if (request.getIcon() != null && !request.getIcon().isBlank()) {
                existing.setIcon(request.getIcon());
            }
            if (request.getColor() != null && !request.getColor().isBlank()) {
                existing.setColor(request.getColor());
            }
            return groupRepository.save(existing);
        });
    }

    @Transactional
    public boolean deleteGroup(String id) {
        if (groupRepository.existsById(id)) {
            tripRepository.deleteByGroupId(id);
            groupRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Transactional
    public Optional<Group> joinGroupByInvite(JoinGroupRequest request) {
        String cleanCode = request.getInviteCode().trim().toUpperCase();
        Optional<Group> opt = groupRepository.findByInviteCode(cleanCode);
        if (opt.isEmpty()) {
            return Optional.empty();
        }

        Group group = opt.get();

        boolean alreadyMember = group.getMembers().stream()
                .anyMatch(m -> m.getId() != null && m.getId().equals(request.getUserId()));

        if (!alreadyMember) {
            GroupMember newMember = GroupMember.builder()
                    .id(request.getUserId())
                    .name(request.getUserName() != null ? request.getUserName() : "Traveler")
                    .avatar(request.getAvatar() != null ? request.getAvatar() : "🎒")
                    .role("member")
                    .color(request.getColor() != null ? request.getColor() : "#10b981")
                    .build();
            newMember.setGroup(group);
            group.getMembers().add(newMember);
            groupRepository.save(group);
        }

        return Optional.of(group);
    }

    @Transactional
    public Optional<Group> removeMember(String groupId, String memberId) {
        return groupRepository.findById(groupId).map(group -> {
            group.getMembers().removeIf(m -> m.getId() != null && m.getId().equals(memberId));
            return groupRepository.save(group);
        });
    }
}
