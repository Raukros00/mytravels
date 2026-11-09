package com.example.tripplanner.model;

/** Categorie di notifiche push che l'utente può attivare o disattivare dal profilo (#97). */
public enum PushCategory {
    /** Inviti nei gruppi e richieste di ingresso (con il loro esito). */
    INVITES,
    /** Proposte di viaggio, voti e approvazioni. */
    PROPOSALS,
    /** Nuovi membri nei gruppi dell'utente (disattivata di default). */
    NEW_MEMBERS,
    /** Promemoria prima della partenza. */
    REMINDERS,
    /** Guida durante il viaggio (#110): buongiorno, pasti, chiusure imminenti e fine giornata. */
    LIVE_GUIDE
}
