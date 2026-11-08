package com.example.tripplanner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.GZIPInputStream;

/**
 * Ricerca di luoghi su Wikidata (dati CC0, nessuna chiave): trova monumenti e attrazioni
 * anche con il nome nella lingua dell'utente ("Torre Eiffel", "Colosseo"), che Photon non indicizza.
 *
 * Due chiamate: `wbsearchentities` (testo → id) e `wbgetentities` (coordinate P625 ed etichette).
 * Le entità senza coordinate (canzoni, dipinti, ...) vengono scartate.
 */
@Component
public class WikidataClient {

    /** Entità con coordinate; `labels` per lingua (es. "it" → "torre Eiffel"). */
    public record Entity(String id, Map<String, String> labels, double lat, double lng) {}

    private static final int SEARCH_LIMIT = 10;

    private final String apiUrl;
    private final RestClient client;
    private final ObjectMapper mapper = new ObjectMapper();

    public WikidataClient(@Value("${wikidata.url:https://www.wikidata.org/w/api.php}") String apiUrl,
                          @Value("${photon.user-agent:WanderBite/1.0 (+https://test.alessandrodominici.dev)}") String userAgent) {
        this.apiUrl = apiUrl == null ? "" : apiUrl.trim();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(3).toMillis());
        this.client = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                // Le entità con tutti i claim sono grandi (centinaia di KB): compresse arrivano prima.
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip")
                .build();
    }

    /** false se WIKIDATA_URL è vuota: si usa solo Photon. */
    public boolean isEnabled() {
        return !apiUrl.isEmpty();
    }

    /** Id delle entità che corrispondono al testo nella lingua indicata (con i fallback di Wikidata). */
    public List<String> search(String query, String language) {
        JsonNode body = get(Map.of(
                "action", "wbsearchentities", "search", query, "language", language, "uselang", language,
                "type", "item", "limit", String.valueOf(SEARCH_LIMIT), "format", "json"));
        if (!body.path("search").isArray()) throw new IllegalStateException("risposta senza 'search'");
        List<String> ids = new ArrayList<>();
        for (JsonNode hit : body.path("search")) {
            String id = hit.path("id").asText("");
            if (id.matches("Q\\d+")) ids.add(id);
        }
        return ids;
    }

    /** Entità con coordinate, nell'ordine di `ids` (quello di rilevanza della ricerca). */
    public List<Entity> entities(List<String> ids, Set<String> languages) {
        if (ids.isEmpty()) return List.of();
        JsonNode body = get(Map.of(
                "action", "wbgetentities", "ids", String.join("|", ids), "props", "claims|labels",
                "languages", String.join("|", new LinkedHashSet<>(languages)), "format", "json"));
        JsonNode entities = body.path("entities");
        if (!entities.isObject()) throw new IllegalStateException("risposta senza 'entities'");
        List<Entity> result = new ArrayList<>();
        for (String id : ids) {
            JsonNode e = entities.path(id);
            JsonNode coords = e.path("claims").path("P625").path(0).path("mainsnak").path("datavalue").path("value");
            if (!coords.path("latitude").isNumber() || !coords.path("longitude").isNumber()) continue;
            Map<String, String> labels = new HashMap<>();
            for (Iterator<Map.Entry<String, JsonNode>> it = e.path("labels").fields(); it.hasNext(); ) {
                Map.Entry<String, JsonNode> l = it.next();
                String value = l.getValue().path("value").asText("").trim();
                if (!value.isEmpty()) labels.put(l.getKey().toLowerCase(Locale.ROOT), value);
            }
            if (labels.isEmpty()) continue;
            result.add(new Entity(id, labels, coords.path("latitude").asDouble(), coords.path("longitude").asDouble()));
        }
        return result;
    }

    private JsonNode get(Map<String, String> params) {
        JsonNode body = client.get()
                .uri(apiUrl, u -> {
                    // Valori come variabili: codifica corretta di spazi, accenti e "|".
                    params.keySet().forEach(k -> u.queryParam(k, "{" + k + "}"));
                    return u.build(params);
                })
                .exchange((req, res) -> {
                    if (res.getStatusCode().isError()) {
                        throw new IllegalStateException("HTTP " + res.getStatusCode().value());
                    }
                    String encoding = res.getHeaders().getFirst(HttpHeaders.CONTENT_ENCODING);
                    try (InputStream in = "gzip".equalsIgnoreCase(encoding)
                            ? new GZIPInputStream(res.getBody()) : res.getBody()) {
                        return mapper.readTree(in);
                    } catch (IOException e) {
                        throw new RestClientException("risposta non leggibile", e);
                    }
                });
        if (body == null) throw new IllegalStateException("risposta vuota");
        return body;
    }
}
