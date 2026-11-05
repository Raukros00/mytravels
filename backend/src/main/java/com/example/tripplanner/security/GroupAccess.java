package com.example.tripplanner.security;

import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.User;
import com.example.tripplanner.service.AuthService;
import com.example.tripplanner.service.GroupService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Regole di accesso ai gruppi, condivise dai controller.
 * L'utente è sempre quello del JWT (il principal è l'email). Membro = presente nella lista membri.
 */
@Component
public class GroupAccess {

    private final AuthService authService;
    private final GroupService groupService;

    public GroupAccess(AuthService authService, GroupService groupService) {
        this.authService = authService;
        this.groupService = groupService;
    }

    public Optional<User> currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) return Optional.empty();
        return authService.findByEmail(authentication.getName());
    }

    /** Il gruppo, solo se l'utente autenticato ne è membro. */
    public Optional<Group> memberGroup(String groupId, Authentication authentication) {
        return currentUser(authentication)
                .flatMap(me -> groupService.getGroup(groupId).filter(g -> isMember(g, me.getId())));
    }

    /** Il gruppo, solo se l'utente autenticato ne è admin. */
    public Optional<Group> adminGroup(String groupId, Authentication authentication) {
        return currentUser(authentication)
                .flatMap(me -> groupService.getGroup(groupId).filter(g -> isAdmin(g, me.getId())));
    }

    public static boolean isMember(Group group, String userId) {
        return group.getMembers().stream().anyMatch(m -> userId.equals(m.getId()));
    }

    public static boolean isAdmin(Group group, String userId) {
        return group.getMembers().stream()
                .anyMatch(m -> userId.equals(m.getId()) && "admin".equalsIgnoreCase(m.getRole()));
    }
}
