package com.example.tripplanner.controller;

import com.example.tripplanner.service.PlaceService;
import com.example.tripplanner.service.PoiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Suggerimenti di luoghi (solo utenti autenticati, come tutto /api/v1): città per la destinazione
 * (GeoNames) e attrazioni/indirizzi (Photon, dati OpenStreetMap).
 */
@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

    private final PlaceService placeService;
    private final PoiService poiService;

    public PlaceController(PlaceService placeService, PoiService poiService) {
        this.placeService = placeService;
        this.poiService = poiService;
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(Map.of(
                "enabled", placeService.isEnabled(),
                "results", placeService.search(q)));
    }

    /** Attrazioni e indirizzi; lat/lng (la destinazione del viaggio) danno priorità ai luoghi vicini. */
    @GetMapping("/poi")
    public ResponseEntity<Map<String, Object>> poi(@RequestParam(defaultValue = "") String q,
                                                   @RequestParam(required = false) Double lat,
                                                   @RequestParam(required = false) Double lng,
                                                   @RequestParam(defaultValue = "it") String lang) {
        return ResponseEntity.ok(Map.of(
                "enabled", poiService.isEnabled(),
                "results", poiService.search(q, lat, lng, lang)));
    }
}
