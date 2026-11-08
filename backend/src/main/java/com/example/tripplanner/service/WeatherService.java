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
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Previsioni del tempo di una giornata (#111) da <b>Open-Meteo</b> (gratuito, senza chiave; dati CC BY 4.0,
 * attribuzione mostrata nella guida). Chiamato dal backend con timeout corti e cache in memoria:
 * previsioni per 1 ora, errori per 10 minuti (per non insistere su un servizio che non risponde).
 * Se Open-Meteo non risponde o la data è fuori dal periodo coperto dalle previsioni la guida resta senza meteo.
 */
@Service
public class WeatherService {

    /** Un'ora della giornata (ora locale della destinazione, "HH:mm"). Valori assenti = null. */
    public record Hour(String time, Double temperature, Integer precipitationProbability, Double precipitation,
                       Integer weatherCode) {}

    /** Riepilogo del giorno. */
    public record Daily(Integer weatherCode, Double temperatureMax, Double temperatureMin,
                        Integer precipitationProbabilityMax, Double precipitationSum) {}

    /** Previsioni di un giorno; `available` false se non disponibili (servizio giù, data troppo lontana...). */
    public record Forecast(boolean available, String date, String timezone, Daily daily, List<Hour> hourly) {
        public static Forecast unavailable(String date) {
            return new Forecast(false, date, null, null, List.of());
        }
    }

    private record Cached(Forecast forecast, Instant expires) {}

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
    private static final Duration TTL = Duration.ofHours(1);
    private static final Duration ERROR_TTL = Duration.ofMinutes(10);
    private static final int MAX_CACHE = 500;
    private static final String DAILY = "weather_code,temperature_2m_max,temperature_2m_min,"
            + "precipitation_probability_max,precipitation_sum";
    private static final String HOURLY = "temperature_2m,precipitation_probability,precipitation,weather_code";

    private final String url;
    private final RestClient client;
    private final Map<String, Cached> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Cached> eldest) {
                    return size() > MAX_CACHE;
                }
            });

    public WeatherService(@Value("${open-meteo.url:https://api.open-meteo.com/v1/forecast}") String url,
                          @Value("${photon.user-agent:WanderBite/1.0}") String userAgent) {
        this.url = url == null ? "" : url.trim();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(4).toMillis());
        this.client = RestClient.builder()
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.USER_AGENT, userAgent)
                .build();
    }

    public boolean isEnabled() {
        return !url.isEmpty();
    }

    /** Previsioni del giorno `date` nel punto indicato (orari nel fuso della destinazione). */
    public Forecast forecast(double lat, double lng, LocalDate date) {
        String day = date.toString();
        if (!isEnabled()) return Forecast.unavailable(day);
        // ~1 km di precisione: viaggi nella stessa città condividono la cache.
        String key = String.format(Locale.ROOT, "%.2f,%.2f,%s", lat, lng, day);
        Cached hit = cache.get(key);
        if (hit != null && hit.expires().isAfter(Instant.now())) return hit.forecast();

        Forecast result;
        try {
            result = parse(fetch(lat, lng, day), day);
        } catch (RestClientException | IllegalStateException e) {
            log.warn("Previsioni Open-Meteo non disponibili per {}: {}", key, e.getMessage());
            result = Forecast.unavailable(day);
        }
        cache.put(key, new Cached(result, Instant.now().plus(result.available() ? TTL : ERROR_TTL)));
        return result;
    }

    private JsonNode fetch(double lat, double lng, String day) {
        String uri = UriComponentsBuilder.fromUriString(url)
                .queryParam("latitude", String.format(Locale.ROOT, "%.4f", lat))
                .queryParam("longitude", String.format(Locale.ROOT, "%.4f", lng))
                .queryParam("daily", DAILY)
                .queryParam("hourly", HOURLY)
                .queryParam("timezone", "auto")
                .queryParam("start_date", day)
                .queryParam("end_date", day)
                .build().encode().toUriString();
        JsonNode body = client.get().uri(URI.create(uri)).retrieve().body(JsonNode.class);
        if (body == null) throw new IllegalStateException("risposta vuota");
        if (body.path("error").asBoolean(false)) throw new IllegalStateException(body.path("reason").asText());
        return body;
    }

    private static Forecast parse(JsonNode body, String day) {
        JsonNode d = body.path("daily");
        if (!d.path("time").isArray() || d.path("time").isEmpty()) throw new IllegalStateException("nessun dato giornaliero");
        Daily daily = new Daily(intAt(d, "weather_code", 0), numAt(d, "temperature_2m_max", 0),
                numAt(d, "temperature_2m_min", 0), intAt(d, "precipitation_probability_max", 0),
                numAt(d, "precipitation_sum", 0));

        JsonNode h = body.path("hourly");
        List<Hour> hours = new ArrayList<>();
        JsonNode times = h.path("time");
        for (int i = 0; i < times.size(); i++) {
            String t = times.get(i).asText("");
            // "2026-07-03T16:00": solo le ore del giorno richiesto.
            if (!t.startsWith(day) || t.length() < 16) continue;
            hours.add(new Hour(t.substring(11, 16), numAt(h, "temperature_2m", i),
                    intAt(h, "precipitation_probability", i), numAt(h, "precipitation", i), intAt(h, "weather_code", i)));
        }
        return new Forecast(true, day, body.path("timezone").asText(null), daily, List.copyOf(hours));
    }

    private static Double numAt(JsonNode parent, String field, int i) {
        JsonNode v = parent.path(field).path(i);
        return v.isNumber() ? v.asDouble() : null;
    }

    private static Integer intAt(JsonNode parent, String field, int i) {
        JsonNode v = parent.path(field).path(i);
        return v.isNumber() ? (int) Math.round(v.asDouble()) : null;
    }
}
