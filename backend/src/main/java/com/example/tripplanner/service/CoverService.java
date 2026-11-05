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
 * Copertine suggerite per una destinazione, cercate su Unsplash.
 * La chiave resta sul server; i risultati sono in cache 24 ore (il piano gratuito ha 50 richieste/ora).
 * Linee guida Unsplash rispettate: hotlink delle URL restituite, credito al fotografo con link
 * (utm_source), "download" segnalato quando una foto viene scelta.
 */
@Service
public class CoverService {

    public record Cover(String id, String url, String thumbUrl, String alt,
                        String authorName, String authorUrl, String downloadLocation) {}

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final String UTM = "utm_source=wanderbite&utm_medium=referral";
    private static final Duration TTL = Duration.ofHours(24);
    private static final int MAX_CACHE = 500;
    private static final int PER_PAGE = 6;

    private record Cached(List<Cover> covers, Instant at) {}

    private final String accessKey;
    private final String apiUrl;
    private final RestClient client;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > MAX_CACHE;
                }
            });

    public CoverService(@Value("${unsplash.access-key:}") String accessKey,
                        @Value("${unsplash.api-url:https://api.unsplash.com}") String apiUrl) {
        this.accessKey = accessKey == null ? "" : accessKey.trim();
        this.apiUrl = apiUrl.replaceAll("/+$", "");
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(3).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(5).toMillis());
        this.client = RestClient.builder().baseUrl(this.apiUrl).requestFactory(factory).build();
    }

    public boolean isEnabled() {
        return !accessKey.isEmpty();
    }

    /** Fino a 6 foto orizzontali per la destinazione; lista vuota se disattivato o in caso di errore. */
    public List<Cover> search(String destination) {
        String query = destination == null ? "" : destination.trim().toLowerCase(Locale.ROOT);
        if (!isEnabled() || query.length() < 2) return List.of();

        Cached hit = cache.get(query);
        if (hit != null && hit.at().plus(TTL).isAfter(Instant.now())) return hit.covers();

        try {
            JsonNode body = client.get()
                    .uri(u -> u.path("/search/photos")
                            .queryParam("query", query + " travel")
                            .queryParam("per_page", PER_PAGE)
                            .queryParam("orientation", "landscape")
                            .queryParam("content_filter", "high")
                            .build())
                    .header("Authorization", "Client-ID " + accessKey)
                    .header("Accept-Version", "v1")
                    .retrieve()
                    .body(JsonNode.class);
            List<Cover> covers = new ArrayList<>();
            if (body != null) {
                for (JsonNode p : body.path("results")) {
                    String raw = p.path("urls").path("raw").asText("");
                    if (raw.isEmpty()) continue;
                    covers.add(new Cover(
                            p.path("id").asText(),
                            raw + "&auto=format&fit=crop&w=1200&q=80",
                            raw + "&auto=format&fit=crop&w=400&h=260&q=70",
                            p.path("alt_description").asText(destination),
                            p.path("user").path("name").asText("Unsplash"),
                            p.path("user").path("links").path("html").asText("https://unsplash.com") + "?" + UTM,
                            p.path("links").path("download_location").asText("")));
                }
            }
            cache.put(query, new Cached(List.copyOf(covers), Instant.now()));
            return covers;
        } catch (RestClientException e) {
            // Limite superato, rete assente...: niente suggerimenti, la creazione del viaggio continua.
            log.warn("Ricerca copertine Unsplash non riuscita per '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    /** Segnala a Unsplash che una foto è stata scelta (obbligatorio da linee guida). */
    public void trackDownload(String downloadLocation) {
        if (!isEnabled() || downloadLocation == null || !downloadLocation.startsWith(apiUrl + "/photos/")) return;
        try {
            client.get().uri(downloadLocation)
                    .header("Authorization", "Client-ID " + accessKey)
                    .retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            log.warn("Segnalazione download Unsplash non riuscita: {}", e.getMessage());
        }
    }
}
