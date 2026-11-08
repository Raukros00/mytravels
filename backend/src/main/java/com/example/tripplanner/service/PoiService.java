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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Suggerimenti di luoghi (attrazioni, indirizzi) per l'autocompletamento, da Photon
 * (Komoot, dati © OpenStreetMap contributors, ODbL).
 *
 * Chiamato dal backend: niente chiamate dal browser verso servizi terzi, cache in memoria
 * per le ricerche identiche (l'istanza pubblica chiede un uso "ragionevole") e timeout corti.
 * In caso di errore la lista è vuota: il campo resta a testo libero.
 */
@Service
public class PoiService {

    /** Luogo normalizzato: nome, indirizzo leggibile, coordinate e categoria OSM (es. "museum"). */
    public record Poi(String id, String name, String address, double lat, double lng, String category) {}

    private static final Logger log = LoggerFactory.getLogger(PoiService.class);
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final int MAX_CACHE = 500;
    private static final int MAX_ROWS = 8;
    /** Ne chiediamo qualcuno in più: i doppioni (stesso nome e indirizzo) vengono scartati. */
    private static final int FETCH_ROWS = 12;
    private static final int MIN_QUERY = 3;
    /** Con la posizione: priorità ai risultati nel raggio di una città (zoom di Photon). */
    private static final int BIAS_ZOOM = 12;

    private record Cached(List<Poi> pois, Instant at) {}

    private final String apiUrl;
    private final Set<String> languages;
    private final RestClient client;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > MAX_CACHE;
                }
            });

    public PoiService(@Value("${photon.url:https://photon.komoot.io/api}") String apiUrl,
                      @Value("${photon.languages:de,en,fr}") String languages,
                      @Value("${photon.user-agent:WanderBite/1.0 (+https://test.alessandrodominici.dev)}") String userAgent) {
        this.apiUrl = apiUrl == null ? "" : apiUrl.trim().replaceAll("/+$", "");
        this.languages = Arrays.stream(languages.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT)).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
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
     * Luoghi che corrispondono a `q`, i più vicini a (lat, lng) per primi se indicati.
     * `lang` viene inoltrato solo se Photon lo supporta (l'istanza pubblica: de, en, fr);
     * altrimenti i nomi sono quelli locali, come sulle insegne.
     */
    public List<Poi> search(String q, Double lat, Double lng, String lang) {
        String query = q == null ? "" : q.trim().replaceAll("\\s+", " ");
        if (!isEnabled() || query.length() < MIN_QUERY) return List.of();
        boolean near = lat != null && lng != null && Double.isFinite(lat) && Double.isFinite(lng)
                && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        String language = lang == null ? "" : lang.trim().toLowerCase(Locale.ROOT);
        if (!languages.contains(language)) language = "";

        // Coordinate arrotondate (~1 km): stessa città = stessa voce in cache.
        String key = query.toLowerCase(Locale.ROOT) + "|" + language + "|"
                + (near ? String.format(Locale.ROOT, "%.2f,%.2f", lat, lng) : "");
        Cached hit = cache.get(key);
        if (hit != null && hit.at().plus(TTL).isAfter(Instant.now())) return hit.pois();

        try {
            List<Poi> pois = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (JsonNode f : fetch(query, near ? lat : null, near ? lng : null, language)) {
                if (pois.size() >= MAX_ROWS) break;
                Poi poi = toPoi(f);
                if (poi == null || !seen.add((poi.name() + "|" + poi.address()).toLowerCase(Locale.ROOT))) continue;
                pois.add(poi);
            }
            List<Poi> result = List.copyOf(pois);
            cache.put(key, new Cached(result, Instant.now()));
            return result;
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Ricerca luoghi Photon non riuscita per '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    private Iterable<JsonNode> fetch(String query, Double lat, Double lng, String language) {
        JsonNode body = client.get()
                .uri(apiUrl, u -> {
                    u.queryParam("q", "{q}").queryParam("limit", FETCH_ROWS);
                    if (!language.isEmpty()) u.queryParam("lang", language);
                    if (lat != null) {
                        u.queryParam("lat", lat).queryParam("lon", lng).queryParam("zoom", BIAS_ZOOM);
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
        String city = firstNonEmpty(text(p, "city"), text(p, "town"), text(p, "village"),
                text(p, "locality"), text(p, "district"), text(p, "county"));
        String country = text(p, "country");
        String address = join(", ", line1, join(" ", text(p, "postcode"), city), country);
        if (name.isEmpty()) name = !line1.isEmpty() ? line1 : city;
        if (name.isEmpty() || address.isEmpty()) return null;

        String id = text(p, "osm_type") + text(p, "osm_id");
        return new Poi(id.isEmpty() ? null : id, name, address, lat, lng, text(p, "osm_value"));
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
