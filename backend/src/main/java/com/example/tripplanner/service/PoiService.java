package com.example.tripplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Suggerimenti di luoghi (attrazioni, indirizzi) per l'autocompletamento, da due fonti in parallelo:
 * <ul>
 *   <li><b>Wikidata</b> (CC0): monumenti e attrazioni cercati anche con il nome nella lingua dell'utente
 *       ("Torre Eiffel", "Colosseo"); l'indirizzo viene dal reverse geocoding di Photon;</li>
 *   <li><b>Photon</b> (Komoot, dati © OpenStreetMap contributors, ODbL): attrazioni, locali e indirizzi
 *       con i nomi locali.</li>
 * </ul>
 * Con la destinazione del viaggio i risultati sono limitati a un raggio attorno ad essa (bbox per Photon,
 * filtro sulle coordinate per entrambe le fonti). Prima i risultati Wikidata, poi Photon, senza doppioni
 * (stesso luogo a meno di {@value #SAME_PLACE_M} m).
 *
 * Chiamate dal backend con cache in memoria e timeout corti: se una fonte non risponde si usano i risultati
 * dell'altra; se non risponde nessuna la lista è vuota e il campo resta a testo libero.
 */
@Service
public class PoiService {

    /**
     * Luogo normalizzato: nome nella lingua dell'utente, eventuale nome locale diverso (es. "Tour Eiffel"),
     * indirizzo leggibile (può essere vuoto per un risultato Wikidata senza indirizzo), coordinate,
     * categoria OSM (es. "museum") e fonte ("wikidata" o "osm").
     */
    public record Poi(String id, String name, String localName, String address, double lat, double lng,
                      String category, String source) {}

    private record Cached<T>(T value, Instant at) {}

    private record Address(String text, String countryCode) {}

    /** Esito di una fonte: `ok` false se non ha risposto (il risultato complessivo non va in cache). */
    private record Partial(List<Poi> pois, boolean ok) {
        static final Partial FAILED = new Partial(List.of(), false);
    }

    private static final Logger log = LoggerFactory.getLogger(PoiService.class);
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final Duration REVERSE_TTL = Duration.ofHours(24);
    private static final int MAX_CACHE = 500;
    private static final int MAX_ROWS = 8;
    /** Ne chiediamo qualcuno in più: doppioni e luoghi fuori area vengono scartati. */
    private static final int FETCH_ROWS = 12;
    private static final int MIN_QUERY = 3;
    /** Con la posizione: priorità ai risultati nel raggio di una città (zoom di Photon). */
    private static final int BIAS_ZOOM = 12;
    private static final int MAX_WIKIDATA = 5;
    /**
     * Senza la destinazione del viaggio non c'è un'area per scartare gli omonimi lontani: teniamo solo i primi
     * risultati Wikidata (i più rilevanti) per non perdere la ricerca in italiano, senza riempire la lista.
     */
    private static final int MAX_WIKIDATA_NO_AREA = 3;
    private static final double SAME_PLACE_M = 150;
    /** Attesa massima di ogni fonte (Wikidata: ricerca + entità + indirizzi). */
    private static final long SOURCE_DEADLINE_MS = 4500;
    private static final long REVERSE_WAIT_MS = 2000;
    private static final double EARTH_KM = 6371.0088;

    /** Lingua dei nomi locali per nazione (codice ISO), per mostrare "Tour Eiffel" sotto "Torre Eiffel". */
    private static final Map<String, String> LOCAL_LANGUAGE = Map.ofEntries(
            Map.entry("FR", "fr"), Map.entry("BE", "fr"), Map.entry("LU", "fr"), Map.entry("MC", "fr"),
            Map.entry("DE", "de"), Map.entry("AT", "de"), Map.entry("CH", "de"), Map.entry("LI", "de"),
            Map.entry("ES", "es"), Map.entry("MX", "es"), Map.entry("AR", "es"), Map.entry("CL", "es"),
            Map.entry("CO", "es"), Map.entry("PE", "es"), Map.entry("CU", "es"),
            Map.entry("PT", "pt"), Map.entry("BR", "pt"),
            Map.entry("GB", "en"), Map.entry("IE", "en"), Map.entry("US", "en"), Map.entry("CA", "en"),
            Map.entry("AU", "en"), Map.entry("NZ", "en"), Map.entry("MT", "en"),
            Map.entry("IT", "it"), Map.entry("SM", "it"), Map.entry("VA", "it"),
            Map.entry("NL", "nl"), Map.entry("PL", "pl"), Map.entry("CZ", "cs"), Map.entry("SK", "sk"),
            Map.entry("GR", "el"), Map.entry("SE", "sv"), Map.entry("DK", "da"), Map.entry("NO", "nb"),
            Map.entry("FI", "fi"), Map.entry("IS", "is"), Map.entry("HR", "hr"), Map.entry("SI", "sl"),
            Map.entry("HU", "hu"), Map.entry("RO", "ro"), Map.entry("BG", "bg"), Map.entry("TR", "tr"),
            Map.entry("RU", "ru"), Map.entry("UA", "uk"), Map.entry("JP", "ja"), Map.entry("CN", "zh"),
            Map.entry("KR", "ko"), Map.entry("TH", "th"), Map.entry("EG", "ar"), Map.entry("MA", "ar"));

    private final String apiUrl;
    private final String reverseUrl;
    private final Set<String> languages;
    private final double radiusKm;
    private final RestClient client;
    private final WikidataClient wikidata;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final Map<String, Cached<List<Poi>>> cache = lruCache(MAX_CACHE);
    private final Map<String, Cached<Address>> reverseCache = lruCache(2 * MAX_CACHE);

    public PoiService(@Value("${photon.url:https://photon.komoot.io/api}") String apiUrl,
                      @Value("${photon.reverse-url:}") String reverseUrl,
                      @Value("${photon.languages:de,en,fr}") String languages,
                      @Value("${photon.user-agent:WanderBite/1.0 (+https://test.alessandrodominici.dev)}") String userAgent,
                      @Value("${places.search-radius-km:40}") double radiusKm,
                      WikidataClient wikidata) {
        this.apiUrl = apiUrl == null ? "" : apiUrl.trim().replaceAll("/+$", "");
        // Di default lo stesso server di Photon: ".../api" → ".../reverse".
        this.reverseUrl = reverseUrl != null && !reverseUrl.isBlank() ? reverseUrl.trim()
                : this.apiUrl.replaceAll("/api$", "/reverse");
        this.languages = Arrays.stream(languages.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT)).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
        this.radiusKm = radiusKm > 0 ? radiusKm : 40;
        this.wikidata = wikidata;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(3).toMillis());
        this.client = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .build();
    }

    /** false se PHOTON_URL è vuota: niente suggerimenti, indirizzo a testo libero. */
    public boolean isEnabled() {
        return !apiUrl.isEmpty();
    }

    /**
     * Luoghi che corrispondono a `q`. Con (lat, lng) (la destinazione del viaggio) solo quelli entro il raggio
     * configurato, i più vicini per primi. `lang` è la lingua dell'utente: usata per Wikidata e, se Photon
     * la supporta (l'istanza pubblica: de, en, fr), anche per Photon.
     */
    public List<Poi> search(String q, Double lat, Double lng, String lang) {
        String query = q == null ? "" : q.trim().replaceAll("\\s+", " ");
        if (!isEnabled() || query.length() < MIN_QUERY) return List.of();
        boolean near = lat != null && lng != null && Double.isFinite(lat) && Double.isFinite(lng)
                && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        String userLanguage = lang == null ? "" : lang.trim().toLowerCase(Locale.ROOT);
        if (!userLanguage.matches("[a-z]{2,3}")) userLanguage = "it";
        String photonLanguage = languages.contains(userLanguage) ? userLanguage : "";

        // Coordinate arrotondate (~1 km): stessa città = stessa voce in cache.
        String key = query.toLowerCase(Locale.ROOT) + "|" + userLanguage + "|"
                + (near ? String.format(Locale.ROOT, "%.2f,%.2f", lat, lng) : "");
        Cached<List<Poi>> hit = cache.get(key);
        if (hit != null && hit.at().plus(TTL).isAfter(Instant.now())) return hit.value();

        Double cLat = near ? lat : null;
        Double cLng = near ? lng : null;
        String wdLanguage = userLanguage;
        CompletableFuture<Partial> photonF = CompletableFuture.supplyAsync(
                () -> searchPhoton(query, cLat, cLng, photonLanguage), executor);
        CompletableFuture<Partial> wikidataF = CompletableFuture.supplyAsync(
                () -> searchWikidata(query, cLat, cLng, wdLanguage), executor);
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(SOURCE_DEADLINE_MS);
        Partial fromWikidata = await(wikidataF, deadline, "Wikidata", query);
        Partial fromPhoton = await(photonF, deadline, "Photon", query);

        List<Poi> merged = new ArrayList<>(fromWikidata.pois());
        List<Poi> wikidataPois = List.copyOf(merged);
        for (Poi p : fromPhoton.pois()) {
            if (merged.size() >= MAX_ROWS) break;
            // Stesso luogo già trovato su Wikidata (che ha il nome nella lingua dell'utente): si tiene quello.
            if (wikidataPois.stream().anyMatch(w -> distanceKm(w.lat(), w.lng(), p.lat(), p.lng()) * 1000 < SAME_PLACE_M)) {
                continue;
            }
            merged.add(p);
        }
        List<Poi> result = List.copyOf(merged);
        if (fromWikidata.ok() && fromPhoton.ok()) cache.put(key, new Cached<>(result, Instant.now()));
        return result;
    }

    private Partial await(CompletableFuture<Partial> future, long deadline, String source, String query) {
        try {
            long wait = Math.max(0, deadline - System.nanoTime());
            return future.get(wait, TimeUnit.NANOSECONDS);
        } catch (Exception e) {
            future.cancel(true);
            log.warn("Ricerca luoghi {} non riuscita per '{}': {}", source, query, e.toString());
            return Partial.FAILED;
        }
    }

    // ---------- Photon ----------

    private Partial searchPhoton(String query, Double lat, Double lng, String language) {
        try {
            List<Poi> pois = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (JsonNode f : fetchPhoton(query, lat, lng, language)) {
                if (pois.size() >= MAX_ROWS) break;
                Poi poi = toPoi(f);
                if (poi == null || !seen.add((poi.name() + "|" + poi.address()).toLowerCase(Locale.ROOT))) continue;
                // Il bbox è un quadrato: gli angoli sono oltre il raggio.
                if (lat != null && distanceKm(lat, lng, poi.lat(), poi.lng()) > radiusKm) continue;
                pois.add(poi);
            }
            return new Partial(pois, true);
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Ricerca luoghi Photon non riuscita per '{}': {}", query, e.getMessage());
            return Partial.FAILED;
        }
    }

    private Iterable<JsonNode> fetchPhoton(String query, Double lat, Double lng, String language) {
        JsonNode body = client.get()
                .uri(apiUrl, u -> {
                    u.queryParam("q", "{q}").queryParam("limit", FETCH_ROWS);
                    if (!language.isEmpty()) u.queryParam("lang", language);
                    if (lat != null) {
                        // lat/lon sono solo una priorità: il bbox limita davvero l'area (niente omonimi in Messico).
                        u.queryParam("lat", lat).queryParam("lon", lng).queryParam("zoom", BIAS_ZOOM)
                                .queryParam("bbox", bbox(lat, lng));
                    }
                    return u.build(query);
                })
                .retrieve()
                .body(JsonNode.class);
        if (body == null || !body.path("features").isArray()) {
            throw new IllegalStateException("risposta senza 'features'");
        }
        return body.path("features");
    }

    /** "minLon,minLat,maxLon,maxLat" del quadrato di lato 2 × raggio attorno al punto. */
    private String bbox(double lat, double lng) {
        double dLat = Math.toDegrees(radiusKm / EARTH_KM);
        double cos = Math.max(0.01, Math.cos(Math.toRadians(lat)));
        double dLng = Math.min(180, dLat / cos);
        return String.format(Locale.ROOT, "%.5f,%.5f,%.5f,%.5f",
                Math.max(-180, lng - dLng), Math.max(-90, lat - dLat),
                Math.min(180, lng + dLng), Math.min(90, lat + dLat));
    }

    /** Feature GeoJSON di Photon → luogo con indirizzo leggibile; null se mancano i dati essenziali. */
    private static Poi toPoi(JsonNode f) {
        JsonNode p = f.path("properties");
        JsonNode coords = f.path("geometry").path("coordinates");
        if (!coords.isArray() || coords.size() < 2) return null;
        double lng = coords.get(0).asDouble();
        double lat = coords.get(1).asDouble();

        String name = text(p, "name");
        String street = text(p, "street");
        String number = text(p, "housenumber");
        boolean isStreet = "street".equals(text(p, "type")) || "highway".equals(text(p, "osm_key"));
        // Prima riga: via e civico ("Carrer de Mallorca 401"); per una strada, la strada stessa.
        String line1 = !street.isEmpty() ? join(" ", street, number)
                : isStreet ? join(" ", name, number) : "";
        String city = cityOf(p);
        String country = text(p, "country");
        String address = join(", ", line1, join(" ", text(p, "postcode"), city), country);
        if (name.isEmpty()) name = !line1.isEmpty() ? line1 : city;
        if (name.isEmpty() || address.isEmpty()) return null;

        String id = text(p, "osm_type") + text(p, "osm_id");
        return new Poi(id.isEmpty() ? null : id, name, null, address, lat, lng, text(p, "osm_value"), "osm");
    }

    // ---------- Wikidata ----------

    private Partial searchWikidata(String query, Double lat, Double lng, String language) {
        if (!wikidata.isEnabled()) return new Partial(List.of(), true);
        try {
            List<String> ids = wikidata.search(query, language);
            Set<String> labelLanguages = new LinkedHashSet<>(List.of(language, "en"));
            labelLanguages.addAll(new TreeSet<>(LOCAL_LANGUAGE.values()));
            List<WikidataClient.Entity> kept = new ArrayList<>();
            for (WikidataClient.Entity e : wikidata.entities(ids, labelLanguages)) {
                if (kept.size() >= (lat != null ? MAX_WIKIDATA : MAX_WIKIDATA_NO_AREA)) break;
                if (lat != null && distanceKm(lat, lng, e.lat(), e.lng()) > radiusKm) continue;
                if (labelFor(e, language) == null) continue;
                if (kept.stream().anyMatch(k -> distanceKm(k.lat(), k.lng(), e.lat(), e.lng()) * 1000 < SAME_PLACE_M)) continue;
                kept.add(e);
            }
            // Indirizzi in parallelo (reverse geocoding di Photon, in cache).
            List<CompletableFuture<Address>> addresses = kept.stream()
                    .map(e -> CompletableFuture.supplyAsync(() -> reverse(e.lat(), e.lng()), executor))
                    .toList();
            List<Poi> pois = new ArrayList<>();
            for (int i = 0; i < kept.size(); i++) {
                WikidataClient.Entity e = kept.get(i);
                Address address = awaitAddress(addresses.get(i));
                String name = capitalize(labelFor(e, language));
                String localName = null;
                String localLanguage = address == null ? null : LOCAL_LANGUAGE.get(address.countryCode());
                String local = localLanguage == null ? null : e.labels().get(localLanguage);
                if (local != null && !local.equalsIgnoreCase(name)) localName = capitalize(local);
                pois.add(new Poi(e.id(), name, localName, address == null ? "" : address.text(),
                        e.lat(), e.lng(), "", "wikidata"));
            }
            return new Partial(pois, true);
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Ricerca luoghi Wikidata non riuscita per '{}': {}", query, e.getMessage());
            return Partial.FAILED;
        }
    }

    private static String labelFor(WikidataClient.Entity e, String language) {
        String label = e.labels().get(language);
        return label != null ? label : e.labels().get("en");
    }

    private static Address awaitAddress(CompletableFuture<Address> future) {
        try {
            return future.get(REVERSE_WAIT_MS, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            // Senza indirizzo il luogo resta utile (nome e coordinate); la richiesta continua e finisce in cache.
            return null;
        }
    }

    /** Indirizzo (via, civico, CAP, città, nazione) del punto: mai il nome del luogo vicino (es. un ristorante). */
    private Address reverse(double lat, double lng) {
        String key = String.format(Locale.ROOT, "%.5f,%.5f", lat, lng);
        Cached<Address> hit = reverseCache.get(key);
        if (hit != null && hit.at().plus(REVERSE_TTL).isAfter(Instant.now())) return hit.value();
        try {
            JsonNode body = client.get()
                    .uri(reverseUrl, u -> u.queryParam("lat", lat).queryParam("lon", lng).queryParam("limit", 1).build())
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode p = body == null ? null : body.path("features").path(0).path("properties");
            Address address = null;
            if (p != null && p.isObject()) {
                String text = join(", ", join(" ", text(p, "street"), text(p, "housenumber")),
                        join(" ", text(p, "postcode"), cityOf(p)), text(p, "country"));
                if (!text.isEmpty()) address = new Address(text, text(p, "countrycode").toUpperCase(Locale.ROOT));
            }
            if (body != null) reverseCache.put(key, new Cached<>(address, Instant.now()));
            return address;
        } catch (RestClientException e) {
            log.warn("Indirizzo Photon non trovato per {}: {}", key, e.getMessage());
            return null;
        }
    }

    // ---------- Utilità ----------

    private static String cityOf(JsonNode p) {
        return firstNonEmpty(text(p, "city"), text(p, "town"), text(p, "village"),
                text(p, "locality"), text(p, "district"), text(p, "county"));
    }

    /** Le etichette Wikidata possono essere minuscole ("torre Eiffel"): prima lettera maiuscola. */
    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        int first = s.codePointAt(0);
        return new String(Character.toChars(Character.toTitleCase(first))) + s.substring(Character.charCount(first));
    }

    static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    private static <T> Map<String, Cached<T>> lruCache(int max) {
        return Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Cached<T>> eldest) {
                return size() > max;
            }
        });
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private static String firstNonEmpty(String... values) {
        for (String v : values) if (!v.isEmpty()) return v;
        return "";
    }

    private static String join(String sep, String... parts) {
        return Arrays.stream(parts).filter(s -> s != null && !s.isEmpty()).collect(Collectors.joining(sep));
    }
}
