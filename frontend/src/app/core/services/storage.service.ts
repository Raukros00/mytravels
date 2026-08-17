import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { Group } from '../models/group.model';
import { Trip } from '../models/trip.model';

const STORAGE_KEYS = {
  USERS: 'wb_users',
  CURRENT_USER: 'wb_current_user',
  GROUPS: 'wb_groups',
  ACTIVE_GROUP_ID: 'wb_active_group_id',
  TRIPS: 'wb_trips'
};

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor() {
    this.initializeSeedData();
  }

  public getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  public setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }

  public removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage remove error:', e);
    }
  }

  // Getters & Setters
  public getUsers(): User[] {
    return this.getItem<User[]>(STORAGE_KEYS.USERS) || [];
  }

  public setUsers(users: User[]): void {
    this.setItem(STORAGE_KEYS.USERS, users);
  }

  public getCurrentUser(): User | null {
    return this.getItem<User>(STORAGE_KEYS.CURRENT_USER);
  }

  public setCurrentUser(user: User | null): void {
    if (user) {
      this.setItem(STORAGE_KEYS.CURRENT_USER, user);
    } else {
      this.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  public getGroups(): Group[] {
    return this.getItem<Group[]>(STORAGE_KEYS.GROUPS) || [];
  }

  public setGroups(groups: Group[]): void {
    this.setItem(STORAGE_KEYS.GROUPS, groups);
  }

  public getActiveGroupId(): string | null {
    return this.getItem<string>(STORAGE_KEYS.ACTIVE_GROUP_ID);
  }

  public setActiveGroupId(id: string | null): void {
    if (id) {
      this.setItem(STORAGE_KEYS.ACTIVE_GROUP_ID, id);
    } else {
      this.removeItem(STORAGE_KEYS.ACTIVE_GROUP_ID);
    }
  }

  public getTrips(): Trip[] {
    return this.getItem<Trip[]>(STORAGE_KEYS.TRIPS) || [];
  }

  public setTrips(trips: Trip[]): void {
    this.setItem(STORAGE_KEYS.TRIPS, trips);
  }

  private initializeSeedData(): void {
    const existingUsers = this.getItem<User[]>(STORAGE_KEYS.USERS);
    if (existingUsers && existingUsers.length > 0) {
      return; // Already initialized
    }

    const defaultUser: User = {
      id: 'usr_demo_1',
      name: 'Alessandro Dominici',
      email: 'alessandro@example.com',
      avatar: '👨‍🍳',
      color: '#4f46e5',
      joinedDate: '2026-01-10'
    };

    const friend1: User = {
      id: 'usr_demo_2',
      name: 'Giulia Bianchi',
      email: 'giulia@example.com',
      avatar: '👩‍🎨',
      color: '#f97316',
      joinedDate: '2026-02-01'
    };

    const friend2: User = {
      id: 'usr_demo_3',
      name: 'Marco Rossi',
      email: 'marco@example.com',
      avatar: '🎒',
      color: '#10b981',
      joinedDate: '2026-02-15'
    };

    const groups: Group[] = [
      {
        id: 'grp_1',
        name: 'Weekend Foodies 🍕',
        description: 'Amanti del buon cibo e dei viaggi on-the-road culinari nel weekend.',
        icon: '🍕',
        color: '#f97316',
        creatorId: defaultUser.id,
        inviteCode: 'FOODIE-2026',
        createdAt: '2026-03-01',
        members: [
          { id: defaultUser.id, name: defaultUser.name, avatar: defaultUser.avatar, role: 'admin', color: defaultUser.color },
          { id: friend1.id, name: friend1.name, avatar: friend1.avatar, role: 'member', color: friend1.color },
          { id: friend2.id, name: friend2.name, avatar: friend2.avatar, role: 'member', color: friend2.color }
        ]
      },
      {
        id: 'grp_2',
        name: 'Giappone & Oriente 🗾',
        description: 'Esplorazione culturale e gastronomica tra Tokyo, Kyoto e Osaka.',
        icon: '🍜',
        color: '#4f46e5',
        creatorId: defaultUser.id,
        inviteCode: 'TOKYO-7799',
        createdAt: '2026-04-12',
        members: [
          { id: defaultUser.id, name: defaultUser.name, avatar: defaultUser.avatar, role: 'admin', color: defaultUser.color },
          { id: friend1.id, name: friend1.name, avatar: friend1.avatar, role: 'member', color: friend1.color }
        ]
      }
    ];

    const trips: Trip[] = [
      {
        id: 'trip_1',
        groupId: 'grp_1',
        title: 'Tour Gastronomico Barcellona: Tapas & Paella',
        destination: 'Barcellona',
        country: 'Spagna',
        startDate: '2026-09-18',
        endDate: '2026-09-22',
        coverUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80',
        status: 'upcoming',
        budgetEstimate: 650,
        currency: 'EUR',
        tags: ['Tapas', 'Gaudí', 'Mare', 'Food Tour'],
        notes: 'Prenotare il tavolo al mercato della Boqueria e tapas bar a El Born.',
        createdAt: '2026-05-10',

        // Detailed Activities
        activities: [
          {
            id: 'act_1',
            tripId: 'trip_1',
            name: 'Basilica della Sagrada Família',
            category: 'monument',
            address: 'Carrer de Mallorca, 401, 08013 Barcelona',
            coordinates: { lat: 41.4036, lng: 2.1744 },
            ticketsRequired: true,
            ticketPrice: 26,
            currency: 'EUR',
            bookingRequired: true,
            bookingUrl: 'https://sagradafamilia.org',
            openingHours: '09:00 - 20:00',
            closingDays: 'Nessuna (aperto tutti i giorni)',
            notes: 'Prenotare biglietti con accesso alle torri almeno 3 settimane prima.',
            assignedDay: 2,
            timeSlot: '10:00 - 12:30',
            isCompleted: false
          },
          {
            id: 'act_2',
            tripId: 'trip_1',
            name: 'Park Güell & Casa Gaudí',
            category: 'nature',
            address: 'Gràcia, 08024 Barcelona',
            coordinates: { lat: 41.4145, lng: 2.1527 },
            ticketsRequired: true,
            ticketPrice: 10,
            currency: 'EUR',
            bookingRequired: true,
            bookingUrl: 'https://parkguell.barcelona',
            openingHours: '09:30 - 19:30',
            closingDays: 'Aperto tutti i giorni',
            notes: 'Salita a piedi ripida, comodo prendere il bus 24 da Plaça Catalunya.',
            assignedDay: 2,
            timeSlot: '15:30 - 18:00',
            isCompleted: false
          },
          {
            id: 'act_3',
            tripId: 'trip_1',
            name: 'Casa Batlló',
            category: 'museum',
            address: 'Passeig de Gràcia, 43, 08007 Barcelona',
            coordinates: { lat: 41.3916, lng: 2.1649 },
            ticketsRequired: true,
            ticketPrice: 29,
            currency: 'EUR',
            bookingRequired: true,
            bookingUrl: 'https://casabatllo.es',
            openingHours: '09:00 - 22:00',
            closingDays: 'Nessuna',
            notes: 'Audioguida immersiva inclusa nel biglietto base.',
            assignedDay: 3,
            timeSlot: '10:30 - 12:30',
            isCompleted: false
          },
          {
            id: 'act_4',
            tripId: 'trip_1',
            name: 'Passeggiata nel Barrio Gótico & Cattedrale',
            category: 'experience',
            address: 'Pla de la Seu, s/n, 08002 Barcelona',
            coordinates: { lat: 41.3840, lng: 2.1762 },
            ticketsRequired: false,
            ticketPrice: 0,
            currency: 'EUR',
            bookingRequired: false,
            openingHours: 'Sempre accessibile',
            closingDays: 'Nessuna',
            notes: 'Esplorare i vicoli medievali, Plaça del Rei e il Pont del Bisbe.',
            assignedDay: 1,
            timeSlot: '16:00 - 18:30',
            isCompleted: false
          },
          {
            id: 'act_5',
            tripId: 'trip_1',
            name: 'Castell de Montjuïc & Funivia',
            category: 'monument',
            address: 'Ctra. de Montjuïc, 66, 08038 Barcelona',
            coordinates: { lat: 41.3634, lng: 2.1664 },
            ticketsRequired: true,
            ticketPrice: 9,
            currency: 'EUR',
            bookingRequired: false,
            openingHours: '10:00 - 20:00',
            closingDays: 'Nessuna',
            notes: 'Vista mozzafiato a 360° su tutta la città e sul porto.',
            assignedDay: null, // In Backlog!
            timeSlot: '',
            isCompleted: false
          }
        ],

        // Detailed Places to Eat
        placesToEat: [
          {
            id: 'eat_1',
            tripId: 'trip_1',
            name: 'El Xampanyet',
            category: 'aperitivo',
            priceRange: '€€',
            address: 'Carrer de Montcada, 22, 08003 Barcelona (El Born)',
            coordinates: { lat: 41.3853, lng: 2.1813 },
            specialties: 'Cava frizzante artigianale, acciughe del Cantabrico, tortilla calda.',
            bookingRequired: false,
            openingHours: '12:00-15:30, 19:00-23:00',
            closingDays: 'Lunedì chiuso',
            notes: 'Molto caratteristico e affollato, andare 15 minuti prima dell\'apertura serale.',
            assignedDay: 1,
            assignedMeal: 'aperitivo',
            timeSlot: '19:30',
            isVisited: false
          },
          {
            id: 'eat_2',
            tripId: 'trip_1',
            name: 'Can Majó - Paella & Pesce',
            category: 'lunch',
            priceRange: '€€€',
            address: 'Carrer de l\'Almirall Cervera, 22, 08003 Barcelona (Barceloneta)',
            coordinates: { lat: 41.3789, lng: 2.1894 },
            specialties: 'Paella de marisco tradizionale, fideuà, pimientos de Padrón.',
            bookingRequired: true,
            openingHours: '13:00 - 16:30',
            closingDays: 'Domenica sera',
            notes: 'Tavoli vista mare sulla spiaggia di Barceloneta.',
            assignedDay: 2,
            assignedMeal: 'lunch',
            timeSlot: '13:30',
            isVisited: false
          },
          {
            id: 'eat_3',
            tripId: 'trip_1',
            name: 'Cervecería Catalana',
            category: 'dinner',
            priceRange: '€€',
            address: 'Carrer de Mallorca, 236, 08008 Barcelona (Eixample)',
            coordinates: { lat: 41.3922, lng: 2.1598 },
            specialties: 'Tapas gourmet, montaditos di manzo e foie gras, patatas bravas.',
            bookingRequired: false,
            openingHours: '09:00 - 01:00',
            closingDays: 'Aperto tutti i giorni',
            notes: 'Non accettano prenotazioni, lasciare il nome all\'ingresso e bere una birra al bancone.',
            assignedDay: 2,
            assignedMeal: 'dinner',
            timeSlot: '21:00',
            isVisited: false
          },
          {
            id: 'eat_4',
            tripId: 'trip_1',
            name: 'Pastelería Escribà',
            category: 'snack',
            priceRange: '€',
            address: 'La Rambla, 83, 08002 Barcelona',
            coordinates: { lat: 41.3817, lng: 2.1730 },
            specialties: 'Crema catalana caramellata, croissant al cioccolato, tartellette.',
            bookingRequired: false,
            openingHours: '09:00 - 21:00',
            closingDays: 'Aperto tutti i giorni',
            notes: 'Pasticceria modernista storica sulla Rambla.',
            assignedDay: 1,
            assignedMeal: 'snack',
            timeSlot: '17:00',
            isVisited: false
          },
          {
            id: 'eat_5',
            tripId: 'trip_1',
            name: 'Bar Pinotxo (Mercat de la Boqueria)',
            category: 'breakfast',
            priceRange: '€€',
            address: 'Rambla, 91, Mercat de la Boqueria, 08001 Barcelona',
            coordinates: { lat: 41.3819, lng: 2.1718 },
            specialties: 'Garbanzos con morcilla, uova con baby calamari, caffè con leche.',
            bookingRequired: false,
            openingHours: '07:00 - 16:00',
            closingDays: 'Domenica chiuso',
            notes: 'Il bancone più celebre della Boqueria per colazione o spuntino energico.',
            assignedDay: null, // In Backlog
            assignedMeal: null,
            timeSlot: '',
            isVisited: false
          }
        ],

        // Flights Details
        flights: {
          outboundFlight: {
            airline: 'Vueling Airlines',
            flightNumber: 'VY6101',
            departureAirport: 'FCO - Roma Fiumicino',
            departureCity: 'Roma',
            departureDateTime: '2026-09-18T07:15',
            arrivalAirport: 'BCN - El Prat',
            arrivalCity: 'Barcellona',
            arrivalDateTime: '2026-09-18T09:10',
            terminal: 'Terminal 1',
            gate: 'B24',
            bookingReference: 'VUE-9821X',
            baggageNotes: '1 trolley a mano 10kg incluso + zainetto sotto il sedile.',
            notes: 'Effettuare check-in online 48 ore prima.'
          },
          returnFlight: {
            airline: 'Vueling Airlines',
            flightNumber: 'VY6108',
            departureAirport: 'BCN - El Prat',
            departureCity: 'Barcellona',
            departureDateTime: '2026-09-22T19:30',
            arrivalAirport: 'FCO - Roma Fiumicino',
            arrivalCity: 'Roma',
            arrivalDateTime: '2026-09-22T21:15',
            terminal: 'Terminal 1',
            gate: 'A12',
            bookingReference: 'VUE-9821X',
            baggageNotes: 'Stesso biglietto di andata.',
            notes: 'Arrivare in aeroporto alle 17:15 per controlli di sicurezza.'
          }
        },

        // Airport Transfers
        transfers: {
          recommendedOption: 'bus',
          passRequired: true,
          passDetails: 'Abbonamento Hola BCN (72h/96h) o carnet T-Casual (10 corse zona 1)',
          specialTickets: 'Biglietto Aerobús (€7.25 solo andata / €12.50 A/R) oppure Metro L9S con supplemento aeroporto (€5.50).',
          taxiVsUberAdvice: 'I Taxi ufficiali (gialli e neri) hanno tariffa fissa/tassametro circa €30-35 fino al centro. Cabify/Uber hanno costi simili. In 3-4 persone con valigie il taxi è la scelta più rapida e comoda.',
          estimatedCost: '€7.25 con Aerobús o €35 totale taxi',
          estimatedDuration: '35 minuti con Aerobús fino a Plaça Catalunya / 25 min in taxi',
          instructions: 'Uscendo dal Terminal 1, seguire i cartelli azzurri "Aerobús A1" al piano inferiore. Frequenza ogni 5-10 minuti. Scendere al capolinea Plaça Catalunya e camminare 5 minuti fino all\'hotel.'
        },

        // Accommodation Details
        accommodation: {
          name: 'Hotel Boutique Ciutat Vella Barcelona',
          address: 'Carrer de Valldonzella, 5, 08001 Barcelona, Spagna',
          coordinates: { lat: 41.3842, lng: 2.1668 },
          checkInDate: '2026-09-18',
          checkInTime: '14:00',
          checkOutDate: '2026-09-22',
          checkOutTime: '11:00',
          bookingCode: 'BK-7892110',
          phoneOrContact: '+34 93 481 37 99 (info@ciutatvella.es)',
          notes: 'Tassa di soggiorno €4.40 a persona/notte da saldare al check-in. Deposito bagagli gratuito disponibile prima del check-in e dopo il check-out. Jacuzzi sulla terrazza sul tetto!'
        }
      },
      {
        id: 'trip_2',
        groupId: 'grp_1',
        title: 'Costiera Amalfitana: Pizza, Limoncello & Sentiero degli Dei',
        destination: 'Amalfi & Napoli',
        country: 'Italia',
        startDate: '2026-10-08',
        endDate: '2026-10-12',
        coverUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
        status: 'planning',
        budgetEstimate: 500,
        currency: 'EUR',
        tags: ['Pizza Napoletana', 'Trekking', 'Panorama'],
        notes: 'Pausa pranzo da Gino Sorbillo e cena vista mare a Positano.',
        createdAt: '2026-06-01',
        activities: [],
        placesToEat: []
      },
      {
        id: 'trip_3',
        groupId: 'grp_2',
        title: 'Tokyo & Kyoto: Ramen, Sushi & Templi',
        destination: 'Tokyo & Kyoto',
        country: 'Giappone',
        startDate: '2026-11-05',
        endDate: '2026-11-18',
        coverUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
        status: 'planning',
        budgetEstimate: 2200,
        currency: 'EUR',
        tags: ['Ramen', 'Sushi Tsukiji', 'Shinkansen', 'Street Food'],
        notes: 'Itinerario dettagliato dei mercati notturni e izakaya a Shinjuku.',
        createdAt: '2026-06-15',
        activities: [],
        placesToEat: []
      }
    ];

    this.setUsers([defaultUser, friend1, friend2]);
    this.setGroups(groups);
    this.setActiveGroupId('grp_1');
    this.setTrips(trips);
    this.setCurrentUser(defaultUser);
  }
}
