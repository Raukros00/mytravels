package com.example.tripplanner.controller;

import com.example.tripplanner.service.PlaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Suggerimenti di città per la destinazione (solo utenti autenticati, come tutto /api/v1). */
@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

    private final PlaceService placeService;

    public PlaceController(PlaceService placeService) {
        this.placeService = placeService;
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(Map.of(
                "enabled", placeService.isEnabled(),
                "results", placeService.search(q)));
    }
}
