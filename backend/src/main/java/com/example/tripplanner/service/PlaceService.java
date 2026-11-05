package com.example.tripplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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

    /** Città il cui nome (in italiano o locale) inizia con `q`, le più popolose prima. */
    public List<Place> search(String q) {
        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (!isEnabled() || query.length() < 2) return List.of();

        Cached hit = cache.get(query);
        if (hit != null && hit.at().plus(TTL).isAfter(Instant.now())) return hit.places();

        try {
            JsonNode body = client.get()
                    .uri(u -> u.path("/searchJSON")
                            .queryParam("name_startsWith", query)
                            .queryParam("featureClass", "P")
                            .queryParam("orderby", "population")
                            .queryParam("maxRows", MAX_ROWS)
                            .queryParam("lang", "it")
                            .queryParam("style", "MEDIUM")
                            .queryParam("username", username)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
            if (body != null && body.has("status")) {
                // GeoNames segnala gli errori (username non abilitato, limite superato) con 200 + "status".
                log.warn("GeoNames: {}", body.path("status").path("message").asText());
                return List.of();
            }
            List<Place> places = new ArrayList<>();
            if (body != null) {
                for (JsonNode g : body.path("geonames")) {
                    String name = g.path("name").asText("");
                    if (name.isEmpty()) continue;
                    places.add(new Place(
                            g.path("geonameId").asText(),
                            name,
                            g.path("toponymName").asText(name),
                            g.path("adminName1").asText(""),
                            g.path("countryName").asText(""),
                            g.path("countryCode").asText(""),
                            g.path("lat").asDouble(),
                            g.path("lng").asDouble()));
                }
            }
            cache.put(query, new Cached(List.copyOf(places), Instant.now()));
            return places;
        } catch (RestClientException e) {
            log.warn("Ricerca città GeoNames non riuscita per '{}': {}", query, e.getMessage());
            return List.of();
        }
    }
}
