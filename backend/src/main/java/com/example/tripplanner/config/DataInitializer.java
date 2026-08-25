package com.example.tripplanner.config;

import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.model.Group;
import com.example.tripplanner.model.Trip;
import com.example.tripplanner.model.TripActivity;
import com.example.tripplanner.model.TripPlaceToEat;
import com.example.tripplanner.model.User;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
import com.example.tripplanner.repository.UserRepository;
import com.example.tripplanner.service.AuthService;
import com.example.tripplanner.service.GroupService;
import com.example.tripplanner.service.TripService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private final AuthService authService;
    private final GroupService groupService;
    private final TripService tripService;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final TripRepository tripRepository;

    public DataInitializer(AuthService authService,
                           GroupService groupService,
                           TripService tripService,
                           UserRepository userRepository,
                           GroupRepository groupRepository,
                           TripRepository tripRepository) {
        this.authService = authService;
        this.groupService = groupService;
        this.tripService = tripService;
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.tripRepository = tripRepository;
    }

    @Override
    public void run(String... args) {
        // Create initial demo admin if not present
        User admin = authService.createDemoUser("admin@example.com", "admin123", "Alessandro");

        // Seed initial group if empty
        if (groupRepository.count() == 0) {
            CreateGroupRequest groupReq = new CreateGroupRequest();
            groupReq.setName("Gli Esploratori ✈️");
            groupReq.setDescription("Gruppo vacanze estive e weekend fuori porta");
            groupReq.setIcon("🌍");
            groupReq.setColor("#6366f1");
            groupReq.setCreatorId(admin.getId());

            Group group = groupService.createGroup(groupReq, admin.getId());

            // Seed initial trip
            if (tripRepository.count() == 0) {
                CreateTripRequest tripReq = new CreateTripRequest();
                tripReq.setGroupId(group.getId());
                tripReq.setTitle("Barcellona Weekend & Tapas 🇪🇸");
                tripReq.setDestination("Barcellona");
                tripReq.setCountry("Spagna");
                tripReq.setStartDate("2026-09-15");
                tripReq.setEndDate("2026-09-18");
                tripReq.setCoverUrl("https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80");
                tripReq.setBudgetEstimate(450.0);
                tripReq.setCurrency("EUR");
                tripReq.setTags(List.of("Gourmet", "Mare", "Architettura"));
                tripReq.setNotes("Non dimenticare di prenotare la Sagrada Família in anticipo!");

                Trip trip = tripService.createTrip(tripReq);

                // Add sample activity
                TripActivity activity = TripActivity.builder()
                        .name("Sagrada Família")
                        .category("monument")
                        .address("C/ de Mallorca, 401, 08013 Barcelona")
                        .ticketsRequired(true)
                        .ticketPrice(26.0)
                        .currency("EUR")
                        .bookingRequired(true)
                        .assignedDay(1)
                        .timeSlot("10:00 - 12:30")
                        .isCompleted(false)
                        .notes("Biglietto con audioguida")
                        .build();
                tripService.addActivity(trip.getId(), activity);

                // Add sample place to eat
                TripPlaceToEat place = TripPlaceToEat.builder()
                        .name("El Xampanyet")
                        .category("dinner")
                        .priceRange("€€")
                        .address("Carrer de Montcada, 22, 08003 Barcelona")
                        .specialties("Tapas tradizionali, acciughe e cava della casa")
                        .bookingRequired(false)
                        .assignedDay(1)
                        .assignedMeal("dinner")
                        .timeSlot("20:30")
                        .isVisited(false)
                        .build();
                tripService.addPlaceToEat(trip.getId(), place);
            }
        }
    }
}
