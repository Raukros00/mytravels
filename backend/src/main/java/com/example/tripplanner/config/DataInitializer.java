package com.example.tripplanner.config;

import com.example.tripplanner.dto.CreateGroupRequest;
import com.example.tripplanner.dto.CreateTripRequest;
import com.example.tripplanner.model.*;
import com.example.tripplanner.repository.GroupRepository;
import com.example.tripplanner.repository.TripRepository;
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
    private final GroupRepository groupRepository;
    private final TripRepository tripRepository;

    public DataInitializer(AuthService authService,
                           GroupService groupService,
                           TripService tripService,
                           GroupRepository groupRepository,
                           TripRepository tripRepository) {
        this.authService = authService;
        this.groupService = groupService;
        this.tripService = tripService;
        this.groupRepository = groupRepository;
        this.tripRepository = tripRepository;
    }

    @Override
    public void run(String... args) {
        if (groupRepository.count() > 0) return;

        // ── Users ─────────────────────────────────────────────────────────────
        User admin  = authService.createDemoUser("admin@example.com",  "admin123",  "Alessandro");
        User sofia  = authService.createDemoUser("sofia@example.com",  "sofia123",  "Sofia");
        User marco  = authService.createDemoUser("marco@example.com",  "marco123",  "Marco");
        User giulia = authService.createDemoUser("giulia@example.com", "giulia123", "Giulia");
        User luca   = authService.createDemoUser("luca@example.com",   "luca123",   "Luca");

        // ── Group 1: Gli Esploratori ───────────────────────────────────────────
        Group esploratori = createGroup("Gli Esploratori ✈️",
                "Gruppo vacanze estive e weekend fuori porta — mare, città e cultura.",
                "🌍", "#6366f1", admin);
        groupService.joinGroupByInvite(joinReq(esploratori.getInviteCode(), sofia));
        groupService.joinGroupByInvite(joinReq(esploratori.getInviteCode(), marco));

        // Trip 1 — Barcellona
        Trip barcellona = createTrip(esploratori, "Barcellona Weekend & Tapas 🇪🇸",
                "Barcellona", "Spagna", "2026-09-15", "2026-09-18",
                "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80",
                "upcoming", 450.0, "EUR",
                List.of("Gourmet", "Architettura", "Mare"),
                "Prenotare Sagrada Família con almeno 2 settimane di anticipo. Portare scarpe comode.");
        addBarcelonaData(barcellona);

        // Trip 2 — Lisbona
        Trip lisbona = createTrip(esploratori, "Lisbona & Sintra 🇵🇹",
                "Lisbona", "Portogallo", "2026-11-10", "2026-11-14",
                "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=80",
                "planning", 520.0, "EUR",
                List.of("Cultura", "Gastronomia", "Tram"),
                "Prendere la Viva Viagem card per i trasporti. Gita a Sintra il terzo giorno.");
        addLisboaData(lisbona);

        // ── Group 2: Foodies on Tour ──────────────────────────────────────────
        Group foodies = createGroup("Foodies on Tour 🍕",
                "Viaggi a tema gastronomico. Mangiamo bene, sempre.",
                "🍽️", "#f97316", marco);
        groupService.joinGroupByInvite(joinReq(foodies.getInviteCode(), giulia));
        groupService.joinGroupByInvite(joinReq(foodies.getInviteCode(), luca));

        // Trip 3 — Napoli
        Trip napoli = createTrip(foodies, "Napoli & Costiera: Pizza e Mare 🍕",
                "Napoli", "Italia", "2026-05-02", "2026-05-06",
                "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=1200&q=80",
                "completed", 380.0, "EUR",
                List.of("Pizza", "Costiera", "Street Food", "Completato"),
                "Viaggio fantastico. Il Ristorante Da Michele era imperdibile.");
        addNapoliData(napoli);

        // Trip 4 — Tokyo
        Trip tokyo = createTrip(foodies, "Tokyo Ramen & Sushi Tour 🍜",
                "Tokyo", "Giappone", "2027-03-20", "2027-03-30",
                "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80",
                "planning", 2100.0, "JPY",
                List.of("Ramen", "Sushi", "Izakaya", "Mercati"),
                "Prenotare Sukiyabashi Jiro con mesi di anticipo. IC Card per metro.");
        addTokyoData(tokyo);

        // ── Group 3: Weekend Warriors ─────────────────────────────────────────
        Group warriors = createGroup("Weekend Warriors 🏔️",
                "Fughe di fine settimana: montagna, natura e avventura.",
                "⛰️", "#10b981", giulia);
        groupService.joinGroupByInvite(joinReq(warriors.getInviteCode(), admin));
        groupService.joinGroupByInvite(joinReq(warriors.getInviteCode(), sofia));
        groupService.joinGroupByInvite(joinReq(warriors.getInviteCode(), luca));

        // Trip 5 — Dolomiti
        Trip dolomiti = createTrip(warriors, "Dolomiti Trekking & Rifugi 🏔️",
                "Cortina d'Ampezzo", "Italia", "2026-07-18", "2026-07-23",
                "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
                "ongoing", 650.0, "EUR",
                List.of("Trekking", "Natura", "Rifugi", "Alta Via"),
                "Scarpe da trekking obbligatorie. Portare mantella antipioggia.");
        addDolomitiData(dolomiti);

        // Trip 6 — Amsterdam
        Trip amsterdam = createTrip(warriors, "Amsterdam Canali & Musei 🇳🇱",
                "Amsterdam", "Olanda", "2026-10-23", "2026-10-26",
                "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1200&q=80",
                "upcoming", 490.0, "EUR",
                List.of("Musei", "Canali", "Bici", "Tulipani"),
                "Noleggiare le bici il primo giorno. Prenotare Rijksmuseum online.");
        addAmsterdamData(amsterdam);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Group createGroup(String name, String desc, String icon, String color, User creator) {
        CreateGroupRequest req = new CreateGroupRequest();
        req.setName(name);
        req.setDescription(desc);
        req.setIcon(icon);
        req.setColor(color);
        req.setCreatorId(creator.getId());
        return groupService.createGroup(req, creator.getId());
    }

    private com.example.tripplanner.dto.JoinGroupRequest joinReq(String code, User user) {
        com.example.tripplanner.dto.JoinGroupRequest r = new com.example.tripplanner.dto.JoinGroupRequest();
        r.setInviteCode(code);
        r.setUserId(user.getId());
        r.setUserName(user.getName());
        r.setAvatar(user.getAvatar());
        r.setColor(user.getColor());
        return r;
    }

    private Trip createTrip(Group group, String title, String dest, String country,
                            String start, String end, String cover,
                            String status, Double budget, String currency,
                            List<String> tags, String notes) {
        CreateTripRequest req = new CreateTripRequest();
        req.setGroupId(group.getId());
        req.setTitle(title);
        req.setDestination(dest);
        req.setCountry(country);
        req.setStartDate(start);
        req.setEndDate(end);
        req.setCoverUrl(cover);
        req.setBudgetEstimate(budget);
        req.setCurrency(currency);
        req.setTags(tags);
        req.setNotes(notes);
        Trip trip = tripService.createTrip(req);
        // set status (createTrip defaults to "planning")
        if (!"planning".equals(status)) {
            tripService.updateTrip(trip.getId(), buildStatusUpdate(status));
        }
        return trip;
    }

    private com.example.tripplanner.dto.UpdateTripRequest buildStatusUpdate(String status) {
        com.example.tripplanner.dto.UpdateTripRequest r = new com.example.tripplanner.dto.UpdateTripRequest();
        r.setStatus(status);
        return r;
    }

    private TripActivity activity(String name, String category, String address,
                                  boolean tickets, Double price, boolean booking,
                                  String url, String hours, String closing,
                                  Integer day, String slot, boolean completed, String notes) {
        return TripActivity.builder()
                .name(name).category(category).address(address)
                .ticketsRequired(tickets).ticketPrice(price).currency("EUR")
                .bookingRequired(booking).bookingUrl(url)
                .openingHours(hours).closingDays(closing)
                .assignedDay(day).timeSlot(slot).isCompleted(completed).notes(notes)
                .build();
    }

    private TripPlaceToEat place(String name, String category, String range,
                                 String address, String specialties,
                                 boolean booking, String hours, String closing,
                                 Integer day, String meal, String slot, boolean visited) {
        return TripPlaceToEat.builder()
                .name(name).category(category).priceRange(range).address(address)
                .specialties(specialties).bookingRequired(booking)
                .openingHours(hours).closingDays(closing)
                .assignedDay(day).assignedMeal(meal).timeSlot(slot).isVisited(visited)
                .build();
    }

    // ── Barcelona ─────────────────────────────────────────────────────────────

    private void addBarcelonaData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Sagrada Família", "monument",
                "C/ de Mallorca, 401, 08013 Barcelona",
                true, 26.0, true, "https://sagradafamilia.org",
                "09:00 - 18:00", "Nessuno", 1, "10:00 - 12:30", false,
                "Biglietto con audioguida. Prenotare online!"));

        tripService.addActivity(id, activity("Park Güell", "nature",
                "Carrer d'Olot, s/n, 08024 Barcelona",
                true, 10.0, true, "https://parkguell.barcelona",
                "08:00 - 20:00", "Nessuno", 1, "14:00 - 16:00", false,
                "Zona monumentale a pagamento; il resto del parco è gratuito."));

        tripService.addActivity(id, activity("Barrio Gótico", "experience",
                "Barri Gòtic, Barcelona",
                false, null, false, null,
                "Sempre aperto", "Nessuno", 2, "10:00 - 13:00", false,
                "Perdersi tra i vicoli. Attenzione ai borseggiatori."));

        tripService.addActivity(id, activity("Museu Picasso", "museum",
                "Carrer de Montcada, 15-23, 08003 Barcelona",
                true, 14.0, false, "https://museupicasso.bcn.cat",
                "10:00 - 19:00", "Lunedì", 2, "15:00 - 17:00", false,
                "Gratis la prima domenica del mese."));

        tripService.addActivity(id, activity("Spiaggia della Barceloneta", "nature",
                "Barceloneta, Barcelona",
                false, null, false, null,
                "Sempre aperta", "Nessuno", 3, "09:00 - 12:00", false,
                "Prendere la metro L4 fino a Barceloneta."));

        tripService.addActivity(id, activity("Camp Nou Tour", "experience",
                "C/ d'Aristides Maillol, 12, 08028 Barcelona",
                true, 32.0, true, "https://www.fcbarcelona.com",
                "10:00 - 18:00", "Nessuno", 3, "14:30 - 16:00", false,
                "Museo del Barça incluso nel biglietto."));

        tripService.addPlaceToEat(id, place("El Xampanyet", "dinner", "€€",
                "Carrer de Montcada, 22, 08003 Barcelona",
                "Tapas tradizionali, acciughe e cava della casa",
                false, "12:00 - 23:00", "Lunedì", 1, "dinner", "20:30", false));

        tripService.addPlaceToEat(id, place("Bar Mut", "lunch", "€€€",
                "Carrer de Pau Claris, 192, 08037 Barcelona",
                "Vermouth artigianale, montaditos, gamberi alla plancha",
                true, "08:00 - 01:00", "Nessuno", 1, "lunch", "13:30", false));

        tripService.addPlaceToEat(id, place("Cervecería Catalana", "lunch", "€€",
                "Carrer de Mallorca, 236, 08008 Barcelona",
                "Patatas bravas, croquetas de jamón, pan con tomate",
                false, "08:00 - 01:30", "Nessuno", 2, "lunch", "13:00", false));

        tripService.addPlaceToEat(id, place("Tickets (Albert Adrià)", "dinner", "€€€€",
                "Avinguda del Paral·lel, 164, 08015 Barcelona",
                "Cucina creativa, tapas d'autore, gin tonic della casa",
                true, "19:00 - 23:30", "Domenica-Lunedì", 2, "dinner", "21:00", false));

        tripService.addPlaceToEat(id, place("La Boqueria — Bar Pinotxo", "breakfast", "€",
                "La Rambla, 91, 08001 Barcelona",
                "Colazione barceloneta, bikini tostato, fresh juice",
                false, "08:00 - 16:00", "Domenica", 3, "breakfast", "09:00", false));

        // Flights
        tripService.updateFlights(id, FlightDetails.builder()
                .outboundFlight(FlightInfo.builder()
                        .airline("Vueling").flightNumber("VY6140")
                        .departureAirport("FCO").departureCity("Roma Fiumicino")
                        .departureDateTime("2026-09-15T06:45")
                        .arrivalAirport("BCN").arrivalCity("Barcellona El Prat")
                        .arrivalDateTime("2026-09-15T08:55")
                        .terminal("T1").bookingReference("VY-98ABC")
                        .baggageNotes("Solo bagaglio a mano incluso").build())
                .returnFlight(FlightInfo.builder()
                        .airline("Vueling").flightNumber("VY6141")
                        .departureAirport("BCN").departureCity("Barcellona El Prat")
                        .departureDateTime("2026-09-18T20:15")
                        .arrivalAirport("FCO").arrivalCity("Roma Fiumicino")
                        .arrivalDateTime("2026-09-18T22:20")
                        .terminal("T1").bookingReference("VY-98ABC").build())
                .build());

        tripService.updateTransfers(id, AirportTransfer.builder()
                .recommendedOption("metro")
                .passRequired(true)
                .passDetails("T-Casual (10 viaggi) oppure Hola BCN! 4 giorni")
                .taxiVsUberAdvice("Taxi ufficiali gialli a prezzo fisso dall'aeroporto (~35€). Uber non disponibile.")
                .estimatedCost("~5€ metro / 35€ taxi")
                .estimatedDuration("35 min in metro, 30 min in taxi")
                .instructions("Prendere L9 Sud (arancione) fino a Torrassa, poi L1 rossa fino al centro.")
                .build());

        tripService.updateAccommodation(id, AccommodationDetails.builder()
                .name("Hotel Arts Barcelona ⭐⭐⭐⭐⭐")
                .address("Carrer de la Marina, 19-21, 08005 Barcelona")
                .coordinates(GeoPoint.builder().lat(41.3874).lng(2.1966).build())
                .checkInDate("2026-09-15").checkInTime("15:00")
                .checkOutDate("2026-09-18").checkOutTime("11:00")
                .bookingCode("ARTS-2026-BCN")
                .phoneOrContact("+34 93 221 10 00")
                .notes("Vista mare dalla camera. Colazione inclusa. Spa disponibile.").build());
    }

    // ── Lisbona ───────────────────────────────────────────────────────────────

    private void addLisboaData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Tram 28 — giro completo", "experience",
                "Praça Martim Moniz, Lisbona",
                true, 3.0, false, null,
                "06:00 - 23:00", "Nessuno", 1, "09:30 - 10:45", false,
                "Biglietto a bordo o con Viva Viagem. Folla altissima in estate — andare presto."));

        tripService.addActivity(id, activity("Castelo de São Jorge", "monument",
                "R. de Santa Cruz do Castelo, 1100-129 Lisboa",
                true, 15.0, false, "https://castelodesaojorge.pt",
                "09:00 - 18:00", "Nessuno", 1, "11:00 - 13:00", false,
                "Vista panoramica su tutta la città."));

        tripService.addActivity(id, activity("Alfama — quartiere storico", "experience",
                "Alfama, Lisboa",
                false, null, false, null,
                "Sempre aperto", "Nessuno", 2, "10:00 - 12:30", false,
                "Ascoltare il fado serale in uno dei locali storici."));

        tripService.addActivity(id, activity("Mosteiro dos Jerónimos", "monument",
                "Praça do Império, 1400-206 Lisboa",
                true, 10.0, false, null,
                "10:00 - 17:30", "Lunedì", 2, "14:00 - 16:00", false,
                "Stile manuelino — architettura unica. Gratis la domenica mattina."));

        tripService.addActivity(id, activity("Palazzo della Pena — Sintra", "monument",
                "Estrada da Pena, 2710-609 Sintra",
                true, 20.0, true, "https://www.parquesdesintra.pt",
                "09:30 - 18:00", "Nessuno", 3, "10:00 - 13:00", false,
                "Gita giornaliera: treno da Rossio (40 min, 4€). Prenotare biglietti online."));

        tripService.addActivity(id, activity("LX Factory", "shopping",
                "R. Rodrigues de Faria 103, 1300-501 Lisboa",
                false, null, false, null,
                "12:00 - 24:00", "Lun-Ven", 4, "16:00 - 18:30", false,
                "Mercatino vintage e negozi di design. Ottimo per souvenir."));

        tripService.addPlaceToEat(id, place("Time Out Market", "lunch", "€€",
                "Av. 24 de Julho 49, 1200-479 Lisboa",
                "Street food gourmet: bacalhau, pastéis, vinho verde",
                false, "10:00 - 00:00", "Nessuno", 1, "lunch", "13:00", false));

        tripService.addPlaceToEat(id, place("Cervejaria Ramiro", "dinner", "€€€",
                "Av. Almirante Reis 1, 1150-007 Lisboa",
                "Frutti di mare freschi: gamberi, aragoste, percebes",
                false, "12:00 - 00:30", "Lunedì", 1, "dinner", "20:00", false));

        tripService.addPlaceToEat(id, place("Pastéis de Belém", "breakfast", "€",
                "R. de Belém 84-92, 1300-085 Lisboa",
                "Pastel de nata originale dal 1837. Irrinunciabile.",
                false, "08:00 - 23:00", "Nessuno", 2, "breakfast", "09:00", false));

        tripService.addPlaceToEat(id, place("O Zé da Mouraria", "dinner", "€€",
                "R. João do Outeiro 24, 1100-304 Lisboa",
                "Cucina portoghese casalinga: bacalhau à brás, cozido",
                false, "12:00 - 22:00", "Domenica", 3, "dinner", "19:30", false));

        tripService.addPlaceToEat(id, place("A Cevicheria", "dinner", "€€€",
                "R. Dom Pedro V 129, 1250-096 Lisboa",
                "Ceviche fusion luso-peruviano, cocktail di qualità",
                true, "12:30 - 23:00", "Domenica", 4, "dinner", "20:30", false));

        tripService.updateFlights(id, FlightDetails.builder()
                .outboundFlight(FlightInfo.builder()
                        .airline("TAP Air Portugal").flightNumber("TP587")
                        .departureAirport("MXP").departureCity("Milano Malpensa")
                        .departureDateTime("2026-11-10T07:20")
                        .arrivalAirport("LIS").arrivalCity("Lisbona Humberto Delgado")
                        .arrivalDateTime("2026-11-10T10:05")
                        .terminal("T1").bookingReference("TP-LIS26")
                        .baggageNotes("23kg bagaglio stiva incluso").build())
                .returnFlight(FlightInfo.builder()
                        .airline("TAP Air Portugal").flightNumber("TP586")
                        .departureAirport("LIS").departureCity("Lisbona Humberto Delgado")
                        .departureDateTime("2026-11-14T18:45")
                        .arrivalAirport("MXP").arrivalCity("Milano Malpensa")
                        .arrivalDateTime("2026-11-14T21:35")
                        .terminal("T1").bookingReference("TP-LIS26").build())
                .build());

        tripService.updateAccommodation(id, AccommodationDetails.builder()
                .name("Bairro Alto Hotel ⭐⭐⭐⭐⭐")
                .address("Praça Luís de Camões 2, 1200-243 Lisboa")
                .coordinates(GeoPoint.builder().lat(38.7116).lng(-9.1426).build())
                .checkInDate("2026-11-10").checkInTime("14:00")
                .checkOutDate("2026-11-14").checkOutTime("12:00")
                .bookingCode("BAH-2026-LIS")
                .phoneOrContact("+351 21 340 8288")
                .notes("Posizione perfetta nel Bairro Alto. Vista sulla città. Colazione lussuosa.").build());
    }

    // ── Napoli ────────────────────────────────────────────────────────────────

    private void addNapoliData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Spaccanapoli", "experience",
                "Via Benedetto Croce, Napoli",
                false, null, false, null,
                "Sempre aperto", "Nessuno", 1, "10:00 - 13:00", true,
                "L'asse viario più caratteristico di Napoli. Street food ovunque."));

        tripService.addActivity(id, activity("Museo Archeologico Nazionale", "museum",
                "Piazza Museo, 19, 80135 Napoli",
                true, 18.0, false, null,
                "09:00 - 19:30", "Martedì", 1, "14:00 - 17:00", true,
                "Collezione pompeiana insuperabile. Gabinetto segreto da prenotare."));

        tripService.addActivity(id, activity("Pompei", "monument",
                "Via Villa dei Misteri, 2, 80045 Pompei",
                true, 18.0, false, null,
                "09:00 - 17:00", "Nessuno", 2, "09:00 - 13:30", true,
                "Treno Circumvesuviana da Napoli (~30 min). Portare acqua e cappello."));

        tripService.addActivity(id, activity("Certosa e Museo di San Martino", "museum",
                "Largo San Martino, 5, 80129 Napoli",
                true, 6.0, false, null,
                "08:30 - 19:30", "Mercoledì", 3, "10:00 - 12:30", true,
                "Vista panoramica sul golfo dal chiostro."));

        tripService.addActivity(id, activity("Grotta Azzurra — Capri", "nature",
                "Via Grotta Azzurra, 80073 Anacapri",
                true, 15.0, true, null,
                "09:00 - 17:00", "Nessuno", 4, "10:00 - 13:00", true,
                "Aliscafo da Molo Beverello (~50 min). Prenotare con anticipo in alta stagione."));

        tripService.addPlaceToEat(id, place("Pizzeria Da Michele", "dinner", "€",
                "Via Cesare Sersale, 1/3, 80139 Napoli",
                "Solo margherita e marinara — la migliore pizza del mondo",
                false, "11:00 - 23:00", "Domenica", 1, "dinner", "19:30", true));

        tripService.addPlaceToEat(id, place("Sfogliatella Mary", "breakfast", "€",
                "Galleria Umberto I, 66, 80132 Napoli",
                "Sfogliatelle ricce e frolle appena sfornate, caffè napoletano",
                false, "08:00 - 20:00", "Domenica", 1, "breakfast", "08:30", true));

        tripService.addPlaceToEat(id, place("La Stanza del Gusto", "dinner", "€€€",
                "Vico Tutti i Santi, 18, 80134 Napoli",
                "Cucina campana creativa, degustazione vini locali",
                true, "19:00 - 23:00", "Lun-Mar", 2, "dinner", "20:30", true));

        tripService.addPlaceToEat(id, place("Trattoria da Nennella", "lunch", "€",
                "Vico Lungo Teatro Nuovo, 103, 80134 Napoli",
                "Pasta e fagioli, ragù napoletano, frittura di paranza",
                false, "12:00 - 15:30", "Domenica", 3, "lunch", "13:00", true));

        tripService.addPlaceToEat(id, place("Bar Mexico", "breakfast", "€",
                "Piazza Dante, 86, 80135 Napoli",
                "Caffè più buono di Napoli, granita al caffè d'estate",
                false, "07:00 - 20:30", "Domenica", 4, "breakfast", "09:00", true));
    }

    // ── Tokyo ─────────────────────────────────────────────────────────────────

    private void addTokyoData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Tsukiji Outer Market", "experience",
                "4 Chome-16-2 Tsukiji, Chuo City, Tokyo",
                false, null, false, null,
                "05:00 - 14:00", "Mercoledì", 1, "06:30 - 09:00", false,
                "Arrivare prestissimo per il sushi fresco del mattino."));

        tripService.addActivity(id, activity("Tempio Senso-ji — Asakusa", "monument",
                "2 Chome-3-1 Asakusa, Taito City, Tokyo",
                false, null, false, null,
                "06:00 - 17:00", "Nessuno", 1, "10:00 - 12:00", false,
                "Nakamise-dori per souvenir. Fortuna con omikuji."));

        tripService.addActivity(id, activity("Shibuya Crossing & Harajuku", "experience",
                "Shibuya, Tokyo",
                false, null, false, null,
                "Sempre aperto", "Nessuno", 2, "14:00 - 18:00", false,
                "Takeshita Street per street fashion. Yoyogi Park nelle vicinanze."));

        tripService.addActivity(id, activity("TeamLab Planets", "experience",
                "6 Chome-1-16 Toyosu, Koto City, Tokyo",
                true, 3200.0, true, "https://teamlab.art",
                "10:00 - 22:00", "Nessuno", 3, "11:00 - 13:00", false,
                "Prenotare online. Portare calzini! Arte digitale immersiva."));

        tripService.addActivity(id, activity("Giro sake a Ginza", "experience",
                "Ginza, Chuo City, Tokyo",
                false, null, false, null,
                "Varia per locale", "Nessuno", 4, "18:00 - 22:00", false,
                "Bar a tema sake e whisky giapponese. Provare il Nikka e il Hibiki."));

        tripService.addActivity(id, activity("Mercato Toyosu — asta tonno", "experience",
                "6 Chome-6-1 Toyosu, Koto City, Tokyo",
                true, 0.0, true, "https://www.shijou.metro.tokyo.lg.jp",
                "05:00 - 06:30", "Mercoledì-Domenica", 6, "05:00 - 06:30", false,
                "Iscrizione lotteria obbligatoria 1 mese prima. Solo 120 posti/giorno."));

        tripService.addPlaceToEat(id, place("Ichiran Ramen Shibuya", "dinner", "€€",
                "1 Chome-22-7 Jinnan, Shibuya City, Tokyo",
                "Ramen tonkotsu in cabine individuali, brodo a personalizzazione infinita",
                false, "24h", "Nessuno", 1, "dinner", "19:00", false));

        tripService.addPlaceToEat(id, place("Sushi Saito (prenotazione difficilissima)", "dinner", "€€€€",
                "1 Chome-9-15 Nishiazabu, Minato City, Tokyo",
                "Omakase sushi — considerato il migliore al mondo",
                true, "12:00 - 14:00 / 18:00 - 21:00", "Dom-Lun", 2, "dinner", "19:00", false));

        tripService.addPlaceToEat(id, place("Katsukura — Tonkatsu Shinjuku", "lunch", "€€",
                "3 Chome-14-27 Shinjuku, Shinjuku City, Tokyo",
                "Tonkatsu croccante con riso e miso soup illimitati",
                false, "11:00 - 22:00", "Nessuno", 3, "lunch", "12:00", false));

        tripService.addPlaceToEat(id, place("Izakaya Torikizoku", "dinner", "€",
                "Varie sedi, Tokyo",
                "Yakitori a 280¥ l'uno — spiedini di pollo alla griglia, birra fredda",
                false, "17:00 - 05:00", "Nessuno", 4, "dinner", "20:00", false));

        tripService.addPlaceToEat(id, place("Conveyor Belt Sushi — Sushiro", "lunch", "€",
                "Varie sedi, Tokyo",
                "Sushi kaiten: ogni piatto da 100-300¥, freschissimo e vario",
                false, "11:00 - 22:00", "Nessuno", 5, "lunch", "12:30", false));

        tripService.updateFlights(id, FlightDetails.builder()
                .outboundFlight(FlightInfo.builder()
                        .airline("Japan Airlines").flightNumber("JL47")
                        .departureAirport("MXP").departureCity("Milano Malpensa")
                        .departureDateTime("2027-03-20T11:30")
                        .arrivalAirport("HND").arrivalCity("Tokyo Haneda")
                        .arrivalDateTime("2027-03-21T07:30")
                        .terminal("T1").bookingReference("JL-TYO27")
                        .baggageNotes("2 bagagli 23kg inclusi. Pasto incluso.").build())
                .returnFlight(FlightInfo.builder()
                        .airline("Japan Airlines").flightNumber("JL46")
                        .departureAirport("HND").departureCity("Tokyo Haneda")
                        .departureDateTime("2027-03-30T10:00")
                        .arrivalAirport("MXP").arrivalCity("Milano Malpensa")
                        .arrivalDateTime("2027-03-30T17:00")
                        .terminal("T1").bookingReference("JL-TYO27").build())
                .build());

        tripService.updateAccommodation(id, AccommodationDetails.builder()
                .name("Park Hyatt Tokyo ⭐⭐⭐⭐⭐")
                .address("3 Chome-7-1-2 Nishishinjuku, Shinjuku City, Tokyo")
                .coordinates(GeoPoint.builder().lat(35.6866).lng(139.6908).build())
                .checkInDate("2027-03-21").checkInTime("15:00")
                .checkOutDate("2027-03-30").checkOutTime("12:00")
                .bookingCode("PH-TOKYO-27")
                .phoneOrContact("+81 3-5322-1234")
                .notes("Camera con vista su Mount Fuji. Bar New York al 52° piano — imperdibile.").build());
    }

    // ── Dolomiti ──────────────────────────────────────────────────────────────

    private void addDolomitiData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Alta Via 1 — Tappa Passo Giau", "nature",
                "Passo Giau, 32020 Colle Santa Lucia BL",
                false, null, false, null,
                "Tutto il giorno", "Nessuno", 1, "07:00 - 13:00", true,
                "Difficoltà: media. Dislivello 650m. Scarponi d'obbligo."));

        tripService.addActivity(id, activity("Tre Cime di Lavaredo", "nature",
                "Drei Zinnen Alm, 39030 Dobbiaco BZ",
                true, 30.0, false, null,
                "Tutto il giorno", "Nessuno", 2, "08:00 - 14:00", true,
                "Biglietto per zona traffico limitato. Giro ad anello ~10km, 3h. Spettacolo."));

        tripService.addActivity(id, activity("Lago di Braies", "nature",
                "Via Lago di Braies, 39030 Braies BZ",
                true, 5.0, false, null,
                "07:00 - 18:00", "Nessuno", 3, "07:30 - 10:00", true,
                "Arrivare prestissimo — si riempie rapidamente. Noleggio barca sul lago."));

        tripService.addActivity(id, activity("Via Ferrata Piccolo Lagazuoi", "experience",
                "Passo Falzarego, 32043 Cortina d'Ampezzo BL",
                true, 10.0, false, null,
                "Tutto il giorno (con luce)", "Nessuno", 4, "09:00 - 14:00", false,
                "Kit ferrata noleggiabile a Cortina. Difficoltà: impegnativa. Casco obbligatorio."));

        tripService.addActivity(id, activity("Cortina d'Ampezzo — centro", "shopping",
                "Corso Italia, 32043 Cortina d'Ampezzo BL",
                false, null, false, null,
                "09:00 - 20:00", "Nessuno", 5, "10:00 - 12:30", false,
                "Negozi di abbigliamento tecnico e souvenir. Gelato da Lovat."));

        tripService.addPlaceToEat(id, place("Rifugio Scotoni", "lunch", "€€",
                "Armentarola, 39030 San Cassiano BZ",
                "Canederli in brodo, speck, casunziei ampezzani",
                false, "09:00 - 17:00", "Nessuno", 1, "lunch", "12:30", true));

        tripService.addPlaceToEat(id, place("Rifugio Auronzo", "lunch", "€€",
                "Tre Cime, 32041 Auronzo di Cadore BL",
                "Minestrone caldo, würstel con crauti, Aperol Spritz con vista",
                false, "08:00 - 17:00", "Nessuno", 2, "lunch", "13:00", true));

        tripService.addPlaceToEat(id, place("Baita Piè Tofane", "dinner", "€€€",
                "Via Cantore 1, 32043 Cortina d'Ampezzo BL",
                "Selvaggina, fondue di formaggio dolomitiche, vino locale",
                true, "12:00 - 22:00", "Lunedì", 3, "dinner", "20:00", false));

        tripService.addPlaceToEat(id, place("Ristorante El Camineto", "dinner", "€€",
                "Piazza Roma 3, 32043 Cortina d'Ampezzo BL",
                "Pasta al ragù di capriolo, polenta e funghi porcini",
                false, "12:00 - 23:00", "Mercoledì", 4, "dinner", "19:30", false));

        tripService.updateAccommodation(id, AccommodationDetails.builder()
                .name("Hotel Cristallo Resort & Spa ⭐⭐⭐⭐⭐")
                .address("Via Rinaldo Menardi 42, 32043 Cortina d'Ampezzo BL")
                .coordinates(GeoPoint.builder().lat(46.5393).lng(12.1354).build())
                .checkInDate("2026-07-18").checkInTime("15:00")
                .checkOutDate("2026-07-23").checkOutTime("11:00")
                .bookingCode("CRIST-2026-CDA")
                .phoneOrContact("+39 0436 881111")
                .notes("Vista sulle Dolomiti. Spa con piscina riscaldata. Colazione a buffet inclusa.").build());
    }

    // ── Amsterdam ─────────────────────────────────────────────────────────────

    private void addAmsterdamData(Trip t) {
        String id = t.getId();

        tripService.addActivity(id, activity("Rijksmuseum", "museum",
                "Museumstraat 1, 1071 XX Amsterdam",
                true, 22.5, true, "https://www.rijksmuseum.nl",
                "09:00 - 17:00", "Nessuno", 1, "09:00 - 12:00", false,
                "Prenotare obbligatoriamente online. La Ronda di Notte è al piano 2."));

        tripService.addActivity(id, activity("Casa di Anne Frank", "museum",
                "Westermarkt 20, 1016 DK Amsterdam",
                true, 16.0, true, "https://www.annefrank.org",
                "09:00 - 22:00", "Yom Kippur", 1, "14:00 - 16:00", false,
                "SOLO prenotazione online — non ci sono biglietti in cassa. Esperienza molto toccante."));

        tripService.addActivity(id, activity("Giro in barca sui canali", "experience",
                "Pier 3 — Prins Hendrikkade, Amsterdam",
                true, 18.0, false, null,
                "10:00 - 22:00", "Nessuno", 2, "11:00 - 12:00", false,
                "Tour di 1 ora. Crociera al tramonto molto romantica."));

        tripService.addActivity(id, activity("Vondelpark & Jordaan", "nature",
                "Vondelpark, 1071 AA Amsterdam",
                false, null, false, null,
                "Sempre aperto", "Nessuno", 2, "14:00 - 17:00", false,
                "Quartiere Jordaan con gallerie d'arte e negozietti vintage. Molto photogenico."));

        tripService.addActivity(id, activity("Van Gogh Museum", "museum",
                "Museumplein 6, 1071 DJ Amsterdam",
                true, 22.0, true, "https://www.vangoghmuseum.nl",
                "09:00 - 17:00", "Nessuno", 3, "10:00 - 12:30", false,
                "Prenotare online. Più di 200 dipinti originali inclusi I Girasoli."));

        tripService.addActivity(id, activity("Mercato delle pulci Waterlooplein", "shopping",
                "Waterlooplein 2, 1011 NX Amsterdam",
                false, null, false, null,
                "09:00 - 17:30", "Domenica", 3, "13:30 - 15:30", false,
                "Il mercato delle pulci più famoso dei Paesi Bassi. Vintage e curiosità."));

        tripService.addPlaceToEat(id, place("Café de Jaren", "lunch", "€€",
                "Nieuwe Doelenstraat 20, 1012 CP Amsterdam",
                "Grand café vista canale, tosti, soep van de dag, bier",
                false, "09:00 - 01:00", "Nessuno", 1, "lunch", "13:00", false));

        tripService.addPlaceToEat(id, place("Brouwerij 't IJ", "dinner", "€€",
                "Funenkade 7, 1018 AL Amsterdam",
                "Birre artigianali sotto un mulino a vento. IJwit e Zatte imperdibili.",
                false, "14:00 - 20:00", "Lun-Mar", 1, "dinner", "18:00", false));

        tripService.addPlaceToEat(id, place("PEKA — Pancakes", "breakfast", "€€",
                "Prinsengracht 191, 1015 DS Amsterdam",
                "Pannenkoeken olandesi con sciroppo, bacon o formaggio",
                false, "09:00 - 21:30", "Nessuno", 2, "breakfast", "09:30", false));

        tripService.addPlaceToEat(id, place("Brasserie Ambassade", "dinner", "€€€",
                "Herengracht 341, 1016 AZ Amsterdam",
                "Cucina francese raffinata su canal house del XVII secolo",
                true, "12:00 - 23:00", "Nessuno", 3, "dinner", "20:00", false));

        tripService.updateFlights(id, FlightDetails.builder()
                .outboundFlight(FlightInfo.builder()
                        .airline("KLM Royal Dutch Airlines").flightNumber("KL1621")
                        .departureAirport("MXP").departureCity("Milano Malpensa")
                        .departureDateTime("2026-10-23T07:05")
                        .arrivalAirport("AMS").arrivalCity("Amsterdam Schiphol")
                        .arrivalDateTime("2026-10-23T09:00")
                        .terminal("T1").bookingReference("KL-AMS26")
                        .baggageNotes("Solo bagaglio a mano. Snack incluso.").build())
                .returnFlight(FlightInfo.builder()
                        .airline("KLM Royal Dutch Airlines").flightNumber("KL1620")
                        .departureAirport("AMS").departureCity("Amsterdam Schiphol")
                        .departureDateTime("2026-10-26T18:30")
                        .arrivalAirport("MXP").arrivalCity("Milano Malpensa")
                        .arrivalDateTime("2026-10-26T20:25")
                        .terminal("T1").bookingReference("KL-AMS26").build())
                .build());

        tripService.updateTransfers(id, AirportTransfer.builder()
                .recommendedOption("train")
                .passRequired(false)
                .specialTickets("Intercity Direct — Schiphol ↔ Amsterdam Centraal (€5.40, 20 min)")
                .taxiVsUberAdvice("Taxi fisso ~50€. Uber disponibile e più economico (~30€).")
                .estimatedCost("€5.40 treno / €30 Uber")
                .estimatedDuration("20 min treno, 30-40 min taxi/Uber con traffico")
                .instructions("Dalla stazione Schiphol prendere il treno intercity diretto per Amsterdam Centraal.")
                .build());

        tripService.updateAccommodation(id, AccommodationDetails.builder()
                .name("Hotel V Nesplein ⭐⭐⭐⭐")
                .address("Nes 49, 1012 KD Amsterdam")
                .coordinates(GeoPoint.builder().lat(52.3712).lng(4.8981).build())
                .checkInDate("2026-10-23").checkInTime("15:00")
                .checkOutDate("2026-10-26").checkOutTime("11:00")
                .bookingCode("HV-AMS26")
                .phoneOrContact("+31 20 662 3234")
                .notes("Centro storico a 5 min a piedi dalla Piazza Dam. Bici in noleggio in hotel.").build());
    }
}
