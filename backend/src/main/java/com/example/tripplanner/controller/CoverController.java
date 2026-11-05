package com.example.tripplanner.controller;

import com.example.tripplanner.service.CoverService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Copertine suggerite per la destinazione di un viaggio (solo utenti autenticati, come tutto /api/v1). */
@RestController
@RequestMapping("/api/v1/covers")
public class CoverController {

    private final CoverService coverService;

    public CoverController(CoverService coverService) {
        this.coverService = coverService;
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(defaultValue = "") String q) {
        return ResponseEntity.ok(Map.of(
                "enabled", coverService.isEnabled(),
                "results", coverService.search(q)));
    }

    /** Da chiamare quando l'utente sceglie una copertina suggerita. */
    @PostMapping("/download")
    public ResponseEntity<Void> download(@RequestBody Map<String, String> body) {
        coverService.trackDownload(body.get("downloadLocation"));
        return ResponseEntity.noContent().build();
    }
}
