package com.example.tripplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Suggerimenti di città per la destinazione di un viaggio, da GeoNames (dati CC BY 4.0).
 * Restituisce il nome in italiano, il nome internazionale (per cercare le copertine su Unsplash),
 * la nazione e le coordinate. Username solo sul server, risultati in cache 24 ore.
 */
@Service
public class PlaceService {

    public record Place(String id, String name, String intlName, String region,
                        String country, String countryCode, double lat, double lng) {}

    private static final Logger log = LoggerFactory.getLogger(PlaceService.class);
    private static final Duration TTL = Duration.ofHours(24);
    private static final int MAX_CACHE = 1000;
    private static final int MAX_ROWS = 8;
    /** Per ogni ricerca ne chiediamo di più a GeoNames: alcuni risultati vengono scartati. */
    private static final int FETCH_ROWS = 15;

    private record Cached(List<Place> places, Instant at) {}

    private final String username;
    private final RestClient client;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > MAX_CACHE;
                }
            });

    public PlaceService(@Value("${geonames.username:}") String username,
                        @Value("${geonames.api-url:https://secure.geonames.org}") String apiUrl) {
        this.username = username == null ? "" : username.trim();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());
        this.client = RestClient.builder().baseUrl(apiUrl.replaceAll("/+$", "")).requestFactory(factory).build();
    }

    public boolean isEnabled() {
        return !username.isEmpty();
    }

    /**
     * Città il cui nome inizia con `q`: prima quelle con quel nome in italiano ("Zurigo"),
     * poi quelle con quel nome locale ("Zürich"), le più popolose prima.
     *
     * Una sola ricerca su tutti i nomi non funziona bene: GeoNames confronta il testo anche con
     * traslitterazioni in altre lingue ("zuriten" = Zliten, "Ginano" = Jinan) e con quartieri o nomi
     * storici, che finiscono davanti alla città cercata. Per questo: due ricerche (nomi italiani /
     * nomi locali), solo località abitate attuali, una voce per nome+regione+nazione.
     */
    public List<Place> search(String q) {
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (!isEnabled() || query.length() < 2) return List.of();

        Cached hit = cache.get(query);
        if (hit != null && hit.at().plus(TTL).isAfter(Instant.now())) return hit.places();

        try {
            List<Place> places = new ArrayList<>();
            Set<String> seenIds = new HashSet<>();
            Set<String> seenLabels = new HashSet<>();
            for (boolean italianNames : new boolean[]{true, false}) {
                for (JsonNode g : fetch(query, italianNames)) {
                    if (places.size() >= MAX_ROWS) break;
                    String id = g.path("geonameId").asText();
                    if (!seenIds.add(id) || EXCLUDED_CODES.contains(g.path("fcode").asText())) continue;
                    String toponym = g.path("toponymName").asText("");
                    // Nella ricerca sui nomi locali, il nome locale deve davvero iniziare con il testo.
                    if (!italianNames && !fold(toponym).startsWith(fold(query))) continue;
                    String name = g.path("name").asText("");
                    if (name.isEmpty() || name.equals(name.toLowerCase(Locale.ROOT))) name = toponym;
                    if (name.isEmpty()) continue;
                    String region = g.path("adminName1").asText("");
                    String country = g.path("countryName").asText("");
                    if (!seenLabels.add(fold(name + "|" + region + "|" + country))) continue;
                    places.add(new Place(id, name, toponym.isEmpty() ? name : toponym, region, country,
                            g.path("countryCode").asText(""), g.path("lat").asDouble(), g.path("lng").asDouble()));
                }
            }
            cache.put(query, new Cached(List.copyOf(places), Instant.now()));
            return places;
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Ricerca città GeoNames non riuscita per '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    /** Tipi GeoNames da non proporre: quartieri, località storiche/abbandonate/distrutte, fattorie, chiese. */
    private static final Set<String> EXCLUDED_CODES = Set.of("PPLX", "PPLH", "PPLQ", "PPLW", "PPLCH", "PPLF", "PPLR");

    private Iterable<JsonNode> fetch(String query, boolean italianNames) {
        JsonNode body = client.get()
                .uri(u -> {
                    u.path("/searchJSON")
                            .queryParam("name_startsWith", query)
                            .queryParam("featureClass", "P")
                            .queryParam("orderby", "population")
                            .queryParam("maxRows", FETCH_ROWS)
                            .queryParam("lang", "it")
                            .queryParam("style", "MEDIUM")
                            .queryParam("username", username);
                    if (italianNames) u.queryParam("searchlang", "it");
                    return u.build();
                })
                .retrieve()
                .body(JsonNode.class);
        if (body != null && body.has("status")) {
            // GeoNames segnala gli errori (username non abilitato, limite superato) con 200 + "status".
            throw new IllegalStateException("GeoNames: " + body.path("status").path("message").asText());
        }
        return body == null ? List.of() : body.path("geonames");
    }

    /** Minuscolo e senza accenti: "Zürich" → "zurich". */
    private static String fold(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT);
    }
}
