import { ActivityCategory, FoodCategory, PriceRange, TripActivity, TripPlaceToEat } from '../models/trip.model';
import { TripTemplate } from '../models/trip-template.model';

/* Mock catalog of ready-made trips (no backend yet, see TECHNICAL_DEBT.md). */

type Act = [day: number, slot: string, name: string, cat: ActivityCategory, address: string, lat: number, lng: number, price?: number];
type Eat = [day: number, meal: FoodCategory, slot: string, name: string, price: PriceRange, address: string, lat: number, lng: number, specialties: string];

function activities(tplId: string, currency: string, rows: Act[]): TripActivity[] {
  return rows.map(([day, slot, name, category, address, lat, lng, price], i) => ({
    id: `${tplId}_a${i + 1}`,
    tripId: tplId,
    name,
    category,
    address,
    coordinates: { lat, lng },
    ticketsRequired: !!price,
    ticketPrice: price,
    currency: price ? currency : undefined,
    bookingRequired: !!price && price >= 25,
    assignedDay: day,
    timeSlot: slot
  }));
}

function places(tplId: string, rows: Eat[]): TripPlaceToEat[] {
  return rows.map(([day, meal, slot, name, priceRange, address, lat, lng, specialties], i) => ({
    id: `${tplId}_e${i + 1}`,
    tripId: tplId,
    name,
    category: meal,
    priceRange,
    address,
    coordinates: { lat, lng },
    specialties,
    bookingRequired: priceRange === '€€€' || priceRange === '€€€€',
    assignedDay: day,
    assignedMeal: meal,
    timeSlot: slot
  }));
}

export const EXPLORE_CATALOG: TripTemplate[] = [
  {
    id: 'tpl_barcellona',
    title: 'Barcellona tra Gaudí e tapas',
    destination: 'Barcellona',
    country: 'Spagna',
    coverUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80',
    durationDays: 4,
    budgetEstimate: 620,
    currency: 'EUR',
    tags: ['Città', 'Cultura', 'Food'],
    description: 'Quattro giorni per vivere Barcellona senza correre: i capolavori di Gaudí, il Barrio Gótico, la spiaggia della Barceloneta e le migliori tapas della città.',
    authorName: 'Giulia R.',
    authorColor: '#AB2F0A',
    rating: 4.8,
    reviewsCount: 214,
    usesCount: 1280,
    activities: activities('tpl_barcellona', 'EUR', [
      [1, '10:00 - 12:30', 'Passeggiata nel Barrio Gótico', 'experience', 'Barri Gòtic', 41.3833, 2.1769],
      [1, '15:00 - 17:00', 'Cattedrale di Barcellona', 'monument', 'Pla de la Seu', 41.3840, 2.1762, 9],
      [1, '18:00 - 20:00', 'Tramonto alla Barceloneta', 'nature', 'Platja de la Barceloneta', 41.3784, 2.1925],
      [2, '09:00 - 12:00', 'Sagrada Família', 'monument', 'Carrer de Mallorca 401', 41.4036, 2.1744, 33],
      [2, '15:00 - 17:30', 'Casa Batlló', 'museum', 'Passeig de Gràcia 43', 41.3917, 2.1649, 35],
      [2, '18:00 - 19:30', 'Passeig de Gràcia e shopping', 'shopping', 'Passeig de Gràcia', 41.3951, 2.1620],
      [3, '09:30 - 13:00', 'Park Güell', 'nature', 'Carrer d\'Olot', 41.4145, 2.1527, 10],
      [3, '16:00 - 18:30', 'Museu Picasso', 'museum', 'Carrer de Montcada 15', 41.3851, 2.1809, 12],
      [4, '10:00 - 13:00', 'Montjuïc e Castello', 'nature', 'Parc de Montjuïc', 41.3637, 2.1664, 9],
      [4, '17:00 - 19:00', 'Fontana Magica di Montjuïc', 'experience', 'Plaça de Carles Buïgas', 41.3711, 2.1517]
    ]),
    placesToEat: places('tpl_barcellona', [
      [1, 'dinner', '21:00 - 22:30', 'Bar Cañete', '€€', 'Carrer de la Unió 17', 41.3794, 2.1738, 'Jamón, tortilla, gambas'],
      [2, 'lunch', '13:30 - 15:00', 'Can Culleretes', '€€', 'Carrer d\'en Quintana 5', 41.3806, 2.1745, 'Cucina catalana tradizionale'],
      [2, 'dinner', '21:00 - 22:30', 'Cervecería Catalana', '€€', 'Carrer de Mallorca 236', 41.3946, 2.1595, 'Tapas e montaditos'],
      [3, 'lunch', '13:30 - 15:00', 'Mercat de la Boqueria', '€', 'La Rambla 91', 41.3817, 2.1717, 'Frutta fresca, bocadillos'],
      [3, 'dinner', '21:00 - 22:30', 'Can Solé', '€€€', 'Carrer de Sant Carles 4', 41.3786, 2.1888, 'Paella de marisco'],
      [4, 'lunch', '13:30 - 15:00', 'La Pepita', '€€', 'Carrer de Còrsega 343', 41.3978, 2.1596, 'Tapas creative']
    ]),
    notes: 'Acquista online i biglietti per Sagrada Família e Park Güell con qualche giorno di anticipo.'
  },
  {
    id: 'tpl_roma',
    title: 'Roma classica in 3 giorni',
    destination: 'Roma',
    country: 'Italia',
    coverUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    durationDays: 3,
    budgetEstimate: 450,
    currency: 'EUR',
    tags: ['Città', 'Cultura', 'Food'],
    description: 'Colosseo, Fori, Vaticano e la Roma dei vicoli: un itinerario compatto per non perdere i grandi classici e mangiare davvero bene.',
    authorName: 'Marco T.',
    authorColor: '#2D6A4F',
    rating: 4.7,
    reviewsCount: 342,
    usesCount: 2140,
    activities: activities('tpl_roma', 'EUR', [
      [1, '09:00 - 12:30', 'Colosseo e Foro Romano', 'monument', 'Piazza del Colosseo', 41.8902, 12.4922, 18],
      [1, '15:00 - 17:00', 'Campidoglio e Altare della Patria', 'monument', 'Piazza Venezia', 41.8946, 12.4823],
      [1, '18:00 - 19:30', 'Fontana di Trevi', 'monument', 'Piazza di Trevi', 41.9009, 12.4833],
      [2, '08:30 - 12:30', 'Musei Vaticani e Cappella Sistina', 'museum', 'Viale Vaticano', 41.9065, 12.4536, 20],
      [2, '13:30 - 15:00', 'Basilica di San Pietro', 'monument', 'Piazza San Pietro', 41.9022, 12.4539],
      [2, '17:00 - 19:00', 'Castel Sant\'Angelo', 'monument', 'Lungotevere Castello 50', 41.9031, 12.4663, 15],
      [3, '10:00 - 12:00', 'Pantheon e Piazza Navona', 'monument', 'Piazza della Rotonda', 41.8986, 12.4769],
      [3, '15:00 - 17:30', 'Trastevere', 'experience', 'Trastevere', 41.8892, 12.4695],
      [3, '18:00 - 19:30', 'Giardino degli Aranci', 'nature', 'Via di Santa Sabina', 41.8855, 12.4783]
    ]),
    placesToEat: places('tpl_roma', [
      [1, 'dinner', '20:30 - 22:00', 'Da Enzo al 29', '€€', 'Via dei Vascellari 29', 41.8880, 12.4756, 'Carbonara, cacio e pepe'],
      [2, 'lunch', '13:00 - 14:00', 'Pizzarium Bonci', '€', 'Via della Meloria 43', 41.9082, 12.4455, 'Pizza al taglio'],
      [2, 'dinner', '20:30 - 22:00', 'Roscioli Salumeria', '€€€', 'Via dei Giubbonari 21', 41.8940, 12.4724, 'Amatriciana, salumi'],
      [3, 'breakfast', '08:30 - 09:30', 'Sant\'Eustachio Il Caffè', '€', 'Piazza Sant\'Eustachio 82', 41.8984, 12.4753, 'Gran caffè'],
      [3, 'dinner', '20:30 - 22:00', 'Da Augusto', '€', 'Piazza de\' Renzi 15', 41.8886, 12.4709, 'Trippa, rigatoni alla gricia']
    ])
  },
  {
    id: 'tpl_tokyo',
    title: 'Tokyo: neon, templi e ramen',
    destination: 'Tokyo',
    country: 'Giappone',
    coverUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    durationDays: 7,
    budgetEstimate: 1850,
    currency: 'EUR',
    tags: ['Città', 'Cultura', 'Avventura', 'Food'],
    description: 'Una settimana per scoprire i mille volti di Tokyo: dai quartieri futuristici di Shibuya e Shinjuku ai templi di Asakusa, con una gita a Nikko e tanto street food.',
    authorName: 'Sara B.',
    authorColor: '#B45309',
    rating: 4.9,
    reviewsCount: 188,
    usesCount: 960,
    activities: activities('tpl_tokyo', 'EUR', [
      [1, '14:00 - 17:00', 'Tempio Senso-ji e Asakusa', 'monument', 'Asakusa, Taito', 35.7148, 139.7967],
      [1, '18:00 - 20:00', 'Tokyo Skytree', 'experience', '1 Chome Oshiage', 35.7101, 139.8107, 22],
      [2, '09:00 - 12:00', 'Santuario Meiji', 'monument', 'Yoyogi Kamizonocho', 35.6764, 139.6993],
      [2, '13:00 - 16:00', 'Harajuku e Takeshita Street', 'shopping', 'Takeshita Street', 35.6702, 139.7027],
      [2, '17:00 - 19:30', 'Shibuya Crossing e Sky', 'experience', 'Shibuya Scramble Square', 35.6595, 139.7005, 20],
      [3, '09:00 - 13:00', 'Mercato di Tsukiji', 'experience', 'Tsukiji, Chuo', 35.6654, 139.7707],
      [3, '14:30 - 18:00', 'teamLab Planets', 'museum', 'Toyosu, Koto', 35.6491, 139.7898, 32],
      [4, '08:00 - 18:00', 'Gita a Nikko', 'nature', 'Nikko, Tochigi', 36.7500, 139.5986, 45],
      [5, '10:00 - 13:00', 'Giardini imperiali', 'nature', 'Chiyoda', 35.6852, 139.7528],
      [5, '15:00 - 18:00', 'Akihabara', 'shopping', 'Akihabara, Chiyoda', 35.6984, 139.7731],
      [6, '10:00 - 13:00', 'Museo Ghibli', 'museum', 'Mitaka', 35.6962, 139.5704, 10],
      [6, '17:00 - 20:00', 'Shinjuku e Omoide Yokocho', 'experience', 'Shinjuku', 35.6938, 139.6989],
      [7, '10:00 - 14:00', 'Shimokitazawa e vintage', 'shopping', 'Shimokitazawa, Setagaya', 35.6613, 139.6684]
    ]),
    placesToEat: places('tpl_tokyo', [
      [1, 'dinner', '19:30 - 21:00', 'Ichiran Ramen', '€', 'Shibuya', 35.6595, 139.7006, 'Tonkotsu ramen'],
      [2, 'lunch', '12:30 - 13:30', 'Afuri Harajuku', '€€', 'Harajuku', 35.6690, 139.7040, 'Ramen allo yuzu'],
      [3, 'breakfast', '09:00 - 10:30', 'Sushi Dai Tsukiji', '€€', 'Tsukiji', 35.6650, 139.7710, 'Sushi omakase'],
      [4, 'lunch', '12:30 - 14:00', 'Yuba Soba a Nikko', '€€', 'Nikko', 36.7510, 139.5990, 'Yuba e soba'],
      [5, 'dinner', '19:00 - 21:00', 'Gonpachi Nishi-Azabu', '€€€', 'Nishi-Azabu', 35.6580, 139.7230, 'Yakitori, tempura'],
      [6, 'dinner', '19:30 - 21:30', 'Izakaya Omoide Yokocho', '€€', 'Shinjuku', 35.6930, 139.6995, 'Spiedini e sake']
    ]),
    notes: 'Acquista una Suica/Pasmo all\'arrivo e valuta il Japan Rail Pass solo se fai gite lunghe.'
  },
  {
    id: 'tpl_lisbona',
    title: 'Lisbona: tram, pastéis e fado',
    destination: 'Lisbona',
    country: 'Portogallo',
    coverUrl: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=80',
    durationDays: 4,
    budgetEstimate: 480,
    currency: 'EUR',
    tags: ['Città', 'Cultura', 'Mare', 'Food'],
    description: 'Colline, miradouros e tram gialli: quattro giorni tra Alfama, Belém e una gita a Sintra, chiudendo ogni serata con un fado.',
    authorName: 'Luca P.',
    authorColor: '#7C3AED',
    rating: 4.6,
    reviewsCount: 129,
    usesCount: 742,
    activities: activities('tpl_lisbona', 'EUR', [
      [1, '10:00 - 13:00', 'Alfama e Castelo de São Jorge', 'monument', 'Rua de Santa Cruz do Castelo', 38.7139, -9.1334, 15],
      [1, '16:00 - 18:00', 'Miradouro da Senhora do Monte', 'nature', 'Largo Monte', 38.7197, -9.1324],
      [2, '09:30 - 13:00', 'Torre e Monastero dos Jerónimos', 'monument', 'Belém', 38.6979, -9.2068, 12],
      [2, '15:00 - 17:00', 'Padrão dos Descobrimentos', 'monument', 'Av. Brasília', 38.6937, -9.2059, 10],
      [3, '09:00 - 17:00', 'Gita a Sintra e Palácio da Pena', 'monument', 'Sintra', 38.7876, -9.3906, 20],
      [4, '10:00 - 12:30', 'Tram 28', 'experience', 'Martim Moniz', 38.7165, -9.1359, 3],
      [4, '14:00 - 17:00', 'LX Factory', 'shopping', 'Rua Rodrigues de Faria 103', 38.7030, -9.1780]
    ]),
    placesToEat: places('tpl_lisbona', [
      [1, 'snack', '11:00 - 11:45', 'Pastéis de Belém', '€', 'Rua de Belém 84', 38.6975, -9.2032, 'Pastéis de nata'],
      [1, 'dinner', '20:00 - 22:00', 'Tasca do Chico', '€€', 'Rua do Diário de Notícias 39', 38.7118, -9.1436, 'Fado dal vivo e petiscos'],
      [2, 'lunch', '13:30 - 15:00', 'Time Out Market', '€€', 'Av. 24 de Julho', 38.7068, -9.1458, 'Food hall'],
      [3, 'dinner', '20:00 - 22:00', 'Taberna da Rua das Flores', '€€', 'Rua das Flores 103', 38.7106, -9.1425, 'Pesce e piccoli piatti'],
      [4, 'lunch', '13:00 - 14:30', 'Cervejaria Ramiro', '€€€', 'Av. Almirante Reis 1', 38.7233, -9.1356, 'Frutti di mare']
    ])
  },
  {
    id: 'tpl_parigi',
    title: 'Parigi romantica in 3 giorni',
    destination: 'Parigi',
    country: 'Francia',
    coverUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    durationDays: 3,
    budgetEstimate: 720,
    currency: 'EUR',
    tags: ['Città', 'Cultura', 'Romantico'],
    description: 'Tour Eiffel, Louvre e Montmartre: un weekend lungo per innamorarsi della ville lumière, tra musei, boulangerie e passeggiate sulla Senna.',
    authorName: 'Chiara M.',
    authorColor: '#DB2777',
    rating: 4.5,
    reviewsCount: 267,
    usesCount: 1510,
    activities: activities('tpl_parigi', 'EUR', [
      [1, '09:30 - 13:00', 'Museo del Louvre', 'museum', 'Rue de Rivoli', 48.8606, 2.3376, 22],
      [1, '15:00 - 17:00', 'Giardino delle Tuileries', 'nature', 'Place de la Concorde', 48.8635, 2.3275],
      [1, '19:00 - 21:00', 'Crociera sulla Senna', 'experience', 'Port de la Bourdonnais', 48.8600, 2.2950, 18],
      [2, '09:00 - 12:00', 'Tour Eiffel', 'monument', 'Champ de Mars', 48.8584, 2.2945, 29],
      [2, '14:00 - 17:00', 'Musée d\'Orsay', 'museum', 'Rue de la Légion d\'Honneur', 48.8600, 2.3266, 16],
      [3, '10:00 - 13:00', 'Montmartre e Sacré-Cœur', 'monument', 'Parvis du Sacré-Cœur', 48.8867, 2.3431],
      [3, '15:00 - 17:30', 'Notre-Dame e Île de la Cité', 'monument', 'Parvis Notre-Dame', 48.8530, 2.3499],
      [3, '18:00 - 19:30', 'Le Marais', 'experience', 'Le Marais', 48.8575, 2.3622]
    ]),
    placesToEat: places('tpl_parigi', [
      [1, 'lunch', '13:00 - 14:00', 'Café Marly', '€€€', 'Rue de Rivoli 93', 48.8613, 2.3358, 'Cucina francese con vista Louvre'],
      [2, 'breakfast', '08:00 - 09:00', 'Du Pain et des Idées', '€', 'Rue Yves Toudic 34', 48.8708, 2.3629, 'Croissant e pain des amis'],
      [2, 'dinner', '20:00 - 22:00', 'Le Relais de l\'Entrecôte', '€€€', 'Rue Marbeuf 15', 48.8696, 2.3040, 'Entrecôte e frites'],
      [3, 'lunch', '12:30 - 14:00', 'L\'As du Fallafel', '€', 'Rue des Rosiers 34', 48.8573, 2.3601, 'Falafel'],
      [3, 'dinner', '20:00 - 22:00', 'Bouillon Chartier', '€€', 'Rue du Faubourg Montmartre 7', 48.8731, 2.3427, 'Cucina classica']
    ])
  },
  {
    id: 'tpl_marrakech',
    title: 'Marrakech tra souk e deserto',
    destination: 'Marrakech',
    country: 'Marocco',
    coverUrl: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80',
    durationDays: 5,
    budgetEstimate: 540,
    currency: 'EUR',
    tags: ['Avventura', 'Cultura', 'Natura'],
    description: 'Cinque giorni tra la medina, i giardini Majorelle, un hammam e una notte nel deserto di Agafay: l\'esperienza marocchina completa.',
    authorName: 'Omar K.',
    authorColor: '#B45309',
    rating: 4.7,
    reviewsCount: 96,
    usesCount: 418,
    activities: activities('tpl_marrakech', 'EUR', [
      [1, '16:00 - 20:00', 'Piazza Jemaa el-Fnaa', 'experience', 'Jemaa el-Fnaa', 31.6258, -7.9891],
      [2, '09:30 - 12:30', 'Souk e Medina', 'shopping', 'Medina di Marrakech', 31.6295, -7.9811],
      [2, '15:00 - 17:00', 'Palazzo Bahia', 'monument', 'Rue Riad Zitoun el Jdid', 31.6216, -7.9830, 7],
      [3, '10:00 - 12:00', 'Giardini Majorelle', 'nature', 'Rue Yves Saint Laurent', 31.6417, -8.0033, 14],
      [3, '15:00 - 17:00', 'Hammam tradizionale', 'experience', 'Medina', 31.6290, -7.9870, 30],
      [4, '09:00 - 19:00', 'Deserto di Agafay in quad e cammello', 'nature', 'Agafay', 31.4300, -8.1700, 60],
      [5, '10:00 - 12:00', 'Tombe Saadiane', 'monument', 'Rue de la Kasbah', 31.6177, -7.9889, 7]
    ]),
    placesToEat: places('tpl_marrakech', [
      [1, 'dinner', '20:00 - 21:30', 'Bancarelle di Jemaa el-Fnaa', '€', 'Jemaa el-Fnaa', 31.6258, -7.9891, 'Tajine, spiedini, harira'],
      [2, 'lunch', '13:00 - 14:30', 'Café des Épices', '€', 'Rahba Kedima 75', 31.6313, -7.9868, 'Tè alla menta, insalate'],
      [3, 'dinner', '20:00 - 22:00', 'Le Jardin', '€€€', 'Rue Mouassine 32', 31.6310, -7.9890, 'Cucina marocchina in giardino'],
      [5, 'lunch', '13:00 - 14:30', 'Nomad', '€€', 'Place des Épices 1', 31.6310, -7.9870, 'Cucina moderna']
    ])
  },
  {
    id: 'tpl_napoli',
    title: 'Napoli: tour del gusto',
    destination: 'Napoli',
    country: 'Italia',
    coverUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80',
    durationDays: 3,
    budgetEstimate: 320,
    currency: 'EUR',
    tags: ['Food', 'Città', 'Cultura'],
    description: 'Pizza, sfogliatelle, caffè e il centro storico UNESCO: un food-trip di tre giorni nella città più verace d\'Italia, con una puntata a Pompei.',
    authorName: 'Anna S.',
    authorColor: '#2D6A4F',
    rating: 4.9,
    reviewsCount: 301,
    usesCount: 1875,
    activities: activities('tpl_napoli', 'EUR', [
      [1, '10:00 - 13:00', 'Spaccanapoli e centro storico', 'experience', 'Via Benedetto Croce', 40.8480, 14.2570],
      [1, '15:30 - 17:30', 'Napoli Sotterranea', 'experience', 'Piazza San Gaetano 68', 40.8517, 14.2564, 12],
      [2, '09:00 - 14:00', 'Scavi di Pompei', 'monument', 'Via Villa dei Misteri', 40.7511, 14.4869, 18],
      [2, '17:00 - 19:00', 'Lungomare Caracciolo', 'nature', 'Via Caracciolo', 40.8300, 14.2350],
      [3, '10:00 - 12:30', 'Museo Archeologico Nazionale', 'museum', 'Piazza Museo 19', 40.8535, 14.2503, 22],
      [3, '15:00 - 17:00', 'Castel dell\'Ovo', 'monument', 'Via Eldorado', 40.8283, 14.2480]
    ]),
    placesToEat: places('tpl_napoli', [
      [1, 'breakfast', '08:30 - 09:30', 'Attanasio', '€', 'Vico Ferrovia 2', 40.8530, 14.2720, 'Sfogliatella ricci e frolla'],
      [1, 'lunch', '13:00 - 14:30', 'Di Matteo', '€', 'Via dei Tribunali 94', 40.8508, 14.2568, 'Pizza fritta e margherita'],
      [1, 'dinner', '20:30 - 22:00', 'Antica Pizzeria da Michele', '€', 'Via Cesare Sersale 1', 40.8497, 14.2635, 'Marinara e margherita'],
      [2, 'dinner', '20:30 - 22:00', 'Trattoria da Nennella', '€€', 'Vico Lungo Teatro Nuovo 103', 40.8421, 14.2467, 'Pasta e patate, polpette'],
      [3, 'snack', '11:00 - 11:30', 'Gran Caffè Gambrinus', '€€', 'Via Chiaia 12', 40.8363, 14.2481, 'Caffè e babà'],
      [3, 'lunch', '13:00 - 14:30', 'Pizzeria Sorbillo', '€', 'Via dei Tribunali 32', 40.8515, 14.2543, 'Pizza napoletana']
    ])
  },
  {
    id: 'tpl_islanda',
    title: 'Islanda on the road',
    destination: 'Islanda',
    country: 'Islanda',
    coverUrl: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?auto=format&fit=crop&w=1200&q=80',
    durationDays: 6,
    budgetEstimate: 1650,
    currency: 'EUR',
    tags: ['Avventura', 'Natura', 'Road trip'],
    description: 'Sei giorni lungo la Ring Road del sud: cascate, ghiacciai, spiagge nere e lagune termali. Serve un 4x4 e un po\' di spirito d\'avventura.',
    authorName: 'Davide L.',
    authorColor: '#0E7490',
    rating: 4.8,
    reviewsCount: 74,
    usesCount: 356,
    activities: activities('tpl_islanda', 'EUR', [
      [1, '10:00 - 14:00', 'Parco Nazionale di Thingvellir', 'nature', 'Thingvellir', 64.2559, -21.1299],
      [1, '15:00 - 18:00', 'Geysir e Gullfoss', 'nature', 'Haukadalur', 64.3271, -20.3024],
      [2, '09:00 - 12:00', 'Cascata di Seljalandsfoss', 'nature', 'Ring Road 1', 63.6156, -19.9886],
      [2, '13:00 - 16:00', 'Skógafoss', 'nature', 'Skógar', 63.5321, -19.5113],
      [3, '10:00 - 14:00', 'Spiaggia nera di Reynisfjara', 'nature', 'Vík í Mýrdal', 63.4044, -19.0716],
      [3, '15:00 - 18:00', 'Trekking sul ghiacciaio Sólheimajökull', 'experience', 'Sólheimajökull', 63.5324, -19.3637, 90],
      [4, '09:00 - 13:00', 'Fjaðrárgljúfur Canyon', 'nature', 'Ring Road 1', 63.7712, -18.1722],
      [5, '10:00 - 15:00', 'Laguna glaciale di Jökulsárlón', 'nature', 'Jökulsárlón', 64.0484, -16.1790, 60],
      [6, '11:00 - 15:00', 'Blue Lagoon', 'experience', 'Svartsengi', 63.8804, -22.4495, 85]
    ]),
    placesToEat: places('tpl_islanda', [
      [1, 'lunch', '12:30 - 13:30', 'Efstidalur II', '€€', 'Efstidalur', 64.2700, -20.3300, 'Gelato della fattoria'],
      [2, 'dinner', '19:30 - 21:00', 'Smiðjan Brugghús', '€€', 'Vík í Mýrdal', 63.4190, -19.0080, 'Birra artigianale e burger'],
      [4, 'dinner', '19:30 - 21:00', 'Systrakaffi', '€€', 'Kirkjubæjarklaustur', 63.7900, -18.0600, 'Zuppa di carne d\'agnello'],
      [6, 'lunch', '13:00 - 14:30', 'Bæjarins Beztu', '€', 'Tryggvagata, Reykjavík', 64.1480, -21.9400, 'Hot dog islandese']
    ]),
    notes: 'Prenota in anticipo auto 4x4 e alloggi: in estate sono i primi a esaurirsi.'
  }
];
