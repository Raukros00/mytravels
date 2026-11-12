package com.example.tripplanner.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Codice ISO 3166-1 alpha-2 della nazione di un viaggio (#123).
 * Di norma arriva dal luogo scelto nell'elenco città (GeoNames); per i viaggi a testo libero si ricava dai
 * nomi più comuni in italiano e inglese (stessa lista della migrazione V16, non esaustiva).
 */
public final class CountryCodes {

    private static final Pattern ISO2 = Pattern.compile("^[A-Za-z]{2}$");
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");

    private CountryCodes() {}

    /** Il codice normalizzato (maiuscolo) se è un alpha-2 valido, altrimenti null. */
    public static String normalize(String code) {
        if (code == null) return null;
        String c = code.trim();
        return ISO2.matcher(c).matches() ? c.toUpperCase(Locale.ROOT) : null;
    }

    /** Codice dal nome della nazione (es. "Spagna", " spain ", "Perù"), null se non riconosciuto. */
    public static String fromName(String country) {
        if (country == null) return null;
        String key = country.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        if (key.isEmpty()) return null;
        String code = NAMES.get(key);
        if (code == null) code = NAMES.get(MARKS.matcher(Normalizer.normalize(key, Normalizer.Form.NFD)).replaceAll(""));
        return code;
    }

    /** Codice esplicito se valido, altrimenti ricavato dal nome. */
    public static String resolve(String code, String country) {
        String c = normalize(code);
        return c != null ? c : fromName(country);
    }

    private static final Map<String, String> NAMES = Map.ofEntries(
            Map.entry("italia", "IT"),
            Map.entry("italy", "IT"),
            Map.entry("spagna", "ES"),
            Map.entry("spain", "ES"),
            Map.entry("espana", "ES"),
            Map.entry("españa", "ES"),
            Map.entry("portogallo", "PT"),
            Map.entry("portugal", "PT"),
            Map.entry("francia", "FR"),
            Map.entry("france", "FR"),
            Map.entry("germania", "DE"),
            Map.entry("germany", "DE"),
            Map.entry("deutschland", "DE"),
            Map.entry("austria", "AT"),
            Map.entry("österreich", "AT"),
            Map.entry("osterreich", "AT"),
            Map.entry("svizzera", "CH"),
            Map.entry("switzerland", "CH"),
            Map.entry("schweiz", "CH"),
            Map.entry("suisse", "CH"),
            Map.entry("paesi bassi", "NL"),
            Map.entry("olanda", "NL"),
            Map.entry("netherlands", "NL"),
            Map.entry("the netherlands", "NL"),
            Map.entry("holland", "NL"),
            Map.entry("belgio", "BE"),
            Map.entry("belgium", "BE"),
            Map.entry("lussemburgo", "LU"),
            Map.entry("luxembourg", "LU"),
            Map.entry("regno unito", "GB"),
            Map.entry("united kingdom", "GB"),
            Map.entry("uk", "GB"),
            Map.entry("gran bretagna", "GB"),
            Map.entry("great britain", "GB"),
            Map.entry("inghilterra", "GB"),
            Map.entry("england", "GB"),
            Map.entry("scozia", "GB"),
            Map.entry("scotland", "GB"),
            Map.entry("galles", "GB"),
            Map.entry("wales", "GB"),
            Map.entry("irlanda", "IE"),
            Map.entry("ireland", "IE"),
            Map.entry("islanda", "IS"),
            Map.entry("iceland", "IS"),
            Map.entry("norvegia", "NO"),
            Map.entry("norway", "NO"),
            Map.entry("svezia", "SE"),
            Map.entry("sweden", "SE"),
            Map.entry("finlandia", "FI"),
            Map.entry("finland", "FI"),
            Map.entry("danimarca", "DK"),
            Map.entry("denmark", "DK"),
            Map.entry("polonia", "PL"),
            Map.entry("poland", "PL"),
            Map.entry("repubblica ceca", "CZ"),
            Map.entry("cechia", "CZ"),
            Map.entry("czech republic", "CZ"),
            Map.entry("czechia", "CZ"),
            Map.entry("slovacchia", "SK"),
            Map.entry("slovakia", "SK"),
            Map.entry("ungheria", "HU"),
            Map.entry("hungary", "HU"),
            Map.entry("slovenia", "SI"),
            Map.entry("croazia", "HR"),
            Map.entry("croatia", "HR"),
            Map.entry("bosnia ed erzegovina", "BA"),
            Map.entry("bosnia", "BA"),
            Map.entry("bosnia and herzegovina", "BA"),
            Map.entry("serbia", "RS"),
            Map.entry("montenegro", "ME"),
            Map.entry("albania", "AL"),
            Map.entry("macedonia del nord", "MK"),
            Map.entry("north macedonia", "MK"),
            Map.entry("grecia", "GR"),
            Map.entry("greece", "GR"),
            Map.entry("bulgaria", "BG"),
            Map.entry("romania", "RO"),
            Map.entry("malta", "MT"),
            Map.entry("cipro", "CY"),
            Map.entry("cyprus", "CY"),
            Map.entry("estonia", "EE"),
            Map.entry("lettonia", "LV"),
            Map.entry("latvia", "LV"),
            Map.entry("lituania", "LT"),
            Map.entry("lithuania", "LT"),
            Map.entry("ucraina", "UA"),
            Map.entry("ukraine", "UA"),
            Map.entry("turchia", "TR"),
            Map.entry("turkey", "TR"),
            Map.entry("turkiye", "TR"),
            Map.entry("türkiye", "TR"),
            Map.entry("monaco", "MC"),
            Map.entry("principato di monaco", "MC"),
            Map.entry("san marino", "SM"),
            Map.entry("citta del vaticano", "VA"),
            Map.entry("città del vaticano", "VA"),
            Map.entry("vaticano", "VA"),
            Map.entry("vatican city", "VA"),
            Map.entry("marocco", "MA"),
            Map.entry("morocco", "MA"),
            Map.entry("tunisia", "TN"),
            Map.entry("egitto", "EG"),
            Map.entry("egypt", "EG"),
            Map.entry("sudafrica", "ZA"),
            Map.entry("south africa", "ZA"),
            Map.entry("kenya", "KE"),
            Map.entry("tanzania", "TZ"),
            Map.entry("mauritius", "MU"),
            Map.entry("seychelles", "SC"),
            Map.entry("maldive", "MV"),
            Map.entry("maldives", "MV"),
            Map.entry("emirati arabi uniti", "AE"),
            Map.entry("emirati arabi", "AE"),
            Map.entry("united arab emirates", "AE"),
            Map.entry("uae", "AE"),
            Map.entry("israele", "IL"),
            Map.entry("israel", "IL"),
            Map.entry("giordania", "JO"),
            Map.entry("jordan", "JO"),
            Map.entry("india", "IN"),
            Map.entry("sri lanka", "LK"),
            Map.entry("nepal", "NP"),
            Map.entry("thailandia", "TH"),
            Map.entry("tailandia", "TH"),
            Map.entry("thailand", "TH"),
            Map.entry("vietnam", "VN"),
            Map.entry("viet nam", "VN"),
            Map.entry("cambogia", "KH"),
            Map.entry("cambodia", "KH"),
            Map.entry("laos", "LA"),
            Map.entry("indonesia", "ID"),
            Map.entry("malesia", "MY"),
            Map.entry("malaysia", "MY"),
            Map.entry("singapore", "SG"),
            Map.entry("filippine", "PH"),
            Map.entry("philippines", "PH"),
            Map.entry("cina", "CN"),
            Map.entry("china", "CN"),
            Map.entry("hong kong", "HK"),
            Map.entry("taiwan", "TW"),
            Map.entry("giappone", "JP"),
            Map.entry("japan", "JP"),
            Map.entry("corea del sud", "KR"),
            Map.entry("south korea", "KR"),
            Map.entry("corea", "KR"),
            Map.entry("australia", "AU"),
            Map.entry("nuova zelanda", "NZ"),
            Map.entry("new zealand", "NZ"),
            Map.entry("stati uniti", "US"),
            Map.entry("stati uniti d'america", "US"),
            Map.entry("usa", "US"),
            Map.entry("united states", "US"),
            Map.entry("united states of america", "US"),
            Map.entry("canada", "CA"),
            Map.entry("messico", "MX"),
            Map.entry("mexico", "MX"),
            Map.entry("méxico", "MX"),
            Map.entry("cuba", "CU"),
            Map.entry("repubblica dominicana", "DO"),
            Map.entry("dominican republic", "DO"),
            Map.entry("brasile", "BR"),
            Map.entry("brazil", "BR"),
            Map.entry("brasil", "BR"),
            Map.entry("argentina", "AR"),
            Map.entry("cile", "CL"),
            Map.entry("chile", "CL"),
            Map.entry("peru", "PE"),
            Map.entry("perù", "PE"),
            Map.entry("colombia", "CO"),
            Map.entry("costa rica", "CR"),
            Map.entry("ecuador", "EC"),
            Map.entry("bolivia", "BO"),
            Map.entry("uruguay", "UY")
    );
}
