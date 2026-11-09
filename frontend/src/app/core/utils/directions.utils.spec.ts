import {
  availableMapsApps,
  detectPlatform,
  directionsUrl,
  formatWalkEstimate,
  placeQuery,
  resolveMapsApp,
  walkEstimate
} from './directions.utils';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const SAGRADA = { name: 'Sagrada Família', address: 'Carrer de Mallorca 401', coordinates: { lat: 41.4036, lng: 2.1744 } };
const BATLLO = { name: 'Casa Batlló', address: 'Passeig de Gràcia 43', coordinates: { lat: 41.3916, lng: 2.1649 } };
const NO_COORDS = { name: 'Bar Cañete', address: 'Carrer de la Unió 17, Barcelona' };

describe('directions.utils', () => {
  describe('piattaforma e app di mappe', () => {
    it('riconosce iPhone, iPad (anche come Mac con il touch), Android e desktop', () => {
      expect(detectPlatform(IPHONE)).toBe('ios');
      expect(detectPlatform(IPAD, 5)).toBe('ios');
      expect(detectPlatform(IPAD, 0)).toBe('desktop');
      expect(detectPlatform(ANDROID)).toBe('android');
      expect(detectPlatform(DESKTOP)).toBe('desktop');
    });

    it('iPhone: Apple Maps con Google Maps come alternativa; Android e desktop: Google Maps; Citymapper ovunque', () => {
      expect(availableMapsApps('ios')).toEqual(['apple', 'google', 'citymapper']);
      expect(availableMapsApps('android')).toEqual(['google', 'citymapper']);
      expect(availableMapsApps('desktop')).toEqual(['google', 'citymapper']);
    });

    it('la preferenza salvata vale solo se l\'app è disponibile sul dispositivo', () => {
      expect(resolveMapsApp('ios', null)).toBe('apple');
      expect(resolveMapsApp('ios', 'citymapper')).toBe('citymapper');
      expect(resolveMapsApp('android', 'apple')).toBe('google');
      expect(resolveMapsApp('desktop', 'boh')).toBe('google');
    });
  });

  describe('directionsUrl', () => {
    it('Apple Maps con le coordinate e i mezzi pubblici (dirflg=r); partenza dalla tappa precedente', () => {
      expect(directionsUrl('apple', BATLLO)).toBe('https://maps.apple.com/?daddr=41.3916,2.1649&dirflg=r');
      expect(directionsUrl('apple', BATLLO, SAGRADA)).toBe('https://maps.apple.com/?saddr=41.4036,2.1744&daddr=41.3916,2.1649&dirflg=r');
    });

    it('Google Maps con travelmode=transit', () => {
      expect(directionsUrl('google', BATLLO))
        .toBe('https://www.google.com/maps/dir/?api=1&destination=41.3916,2.1649&travelmode=transit');
      expect(directionsUrl('google', BATLLO, SAGRADA))
        .toBe('https://www.google.com/maps/dir/?api=1&origin=41.4036,2.1744&destination=41.3916,2.1649&travelmode=transit');
    });

    it('Citymapper con coordinate e nomi', () => {
      expect(directionsUrl('citymapper', BATLLO, SAGRADA)).toBe(
        'https://citymapper.com/directions?startcoord=41.4036,2.1744&startname=Sagrada%20Fam%C3%ADlia'
        + '&endcoord=41.3916,2.1649&endname=Casa%20Batll%C3%B3');
    });

    it('senza coordinate usa nome e indirizzo (anche per la partenza)', () => {
      expect(directionsUrl('google', NO_COORDS))
        .toBe('https://www.google.com/maps/dir/?api=1&destination=Bar%20Ca%C3%B1ete,%20Carrer%20de%20la%20Uni%C3%B3%2017,%20Barcelona&travelmode=transit');
      expect(directionsUrl('apple', SAGRADA, NO_COORDS))
        .toContain('saddr=Bar%20Ca%C3%B1ete,%20Carrer%20de%20la%20Uni%C3%B3%2017,%20Barcelona&daddr=41.4036,2.1744');
      expect(directionsUrl('citymapper', NO_COORDS)).toBe(
        'https://citymapper.com/directions?endaddress=Bar%20Ca%C3%B1ete,%20Carrer%20de%20la%20Uni%C3%B3%2017,%20Barcelona&endname=Bar%20Ca%C3%B1ete');
    });

    it('una partenza vuota viene ignorata (si parte dalla posizione attuale)', () => {
      expect(directionsUrl('google', BATLLO, { name: '', address: '' })).not.toContain('origin=');
      expect(directionsUrl('apple', BATLLO, null)).not.toContain('saddr=');
    });

    it('placeQuery: non ripete il nome già nell\'indirizzo', () => {
      expect(placeQuery({ name: 'Hotel Arts', address: 'Hotel Arts, Carrer de la Marina 19' })).toBe('Hotel Arts, Carrer de la Marina 19');
      expect(placeQuery({ name: 'Duomo', address: '' })).toBe('Duomo');
      expect(placeQuery({ name: '', address: 'Via Roma 1' })).toBe('Via Roma 1');
    });
  });

  describe('stima a piedi', () => {
    it('distanza in linea d\'aria e tempo a ~4,8 km/h con fattore percorso 1,3', () => {
      const est = walkEstimate(SAGRADA, BATLLO)!;
      expect(est.meters).toBeGreaterThan(1500);
      expect(est.meters).toBeLessThan(1600);
      // 1,55 km × 1,3 / 80 m al minuto ≈ 25 min.
      expect(est.minutes).toBe(Math.round(est.meters * 1.3 / 80));
      expect(formatWalkEstimate(est)).toBe(`1,6 km · ~${est.minutes} min a piedi`);
    });

    it('formati: metri, ore, inglese', () => {
      expect(formatWalkEstimate({ meters: 1200, minutes: 15 })).toBe('1,2 km · ~15 min a piedi');
      expect(formatWalkEstimate({ meters: 1200, minutes: 15 }, 'en')).toBe('1.2 km · ~15 min walk');
      expect(formatWalkEstimate({ meters: 340, minutes: 6 })).toBe('340 m · ~6 min a piedi');
      expect(formatWalkEstimate({ meters: 6000, minutes: 98 })).toBe('6,0 km · ~1 h 38 min a piedi');
      expect(formatWalkEstimate({ meters: 4400, minutes: 60 })).toBe('4,4 km · ~1 h a piedi');
    });

    it('solo se entrambe le tappe hanno coordinate; almeno 1 minuto', () => {
      expect(walkEstimate(SAGRADA, NO_COORDS)).toBeNull();
      expect(walkEstimate(null, BATLLO)).toBeNull();
      expect(walkEstimate(SAGRADA, SAGRADA)).toEqual({ meters: 0, minutes: 1 });
    });
  });
});
