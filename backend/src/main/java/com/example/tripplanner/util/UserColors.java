package com.example.tripplanner.util;

import java.util.List;

/**
 * Colore dell'utente (#122): sfondo dell'avatar emoji e colore della persona nelle spese.
 * Non si sceglie più in registrazione: viene assegnato in automatico dall'id, da una tavolozza di tinte
 * scure e distinte tra loro, tutte con contrasto almeno 4.5:1 con il testo bianco (WCAG AA).
 * Deve restare allineata con {@code USER_COLOR_PALETTE} del frontend.
 */
public final class UserColors {

    public static final List<String> PALETTE = List.of(
            "#1d4ed8", // blu
            "#c2410c", // arancio
            "#047857", // smeraldo
            "#be123c", // rosa
            "#7c3aed", // viola
            "#0e7490", // ciano
            "#a21caf", // fucsia
            "#3f6212", // oliva
            "#334155"  // ardesia
    );

    private UserColors() {}

    /** Colore stabile per l'id (stesso id → stesso colore). */
    public static String forId(String id) {
        if (id == null) return PALETTE.get(0);
        return PALETTE.get(Math.floorMod(id.hashCode(), PALETTE.size()));
    }
}
