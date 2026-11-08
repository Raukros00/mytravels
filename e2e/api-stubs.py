"""Finti servizi esterni per i test e2e (Unsplash, GeoNames e Photon): stessa forma di risposta delle API reali,
nessuna rete esterna.

GeoNames
GET  /searchJSON?name_startsWith=...&username=e2e -> città il cui nome italiano o locale inizia con il testo

Photon (luoghi OpenStreetMap)
GET  /photon/api?q=...[&lat=&lon=][&lang=] -> GeoJSON dei luoghi che contengono il testo, i più vicini prima
                                             se c'è la posizione. Come l'istanza pubblica: lang solo
                                             default/de/en/fr (altrimenti 400). Un testo con "offline" -> 503.

Unsplash
GET  /search/photos?query=...   -> 3 foto (alt con la query), richiede "Authorization: Client-ID e2e-fake-key"
GET  /photos/<id>/download      -> registra il "download" (linee guida Unsplash)
GET  /img/<id>                  -> immagine PNG servita al browser
GET  /__state                   -> per i test: ricerche e download ricevuti
"""
import json
import math
import os
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

KEY = os.environ.get("STUB_KEY", "e2e-fake-key")
PUBLIC = os.environ.get("PUBLIC_URL", "http://127.0.0.1:18090")
API = os.environ.get("API_URL", "http://api-stubs:8000")
IMAGE = open(os.environ.get("STUB_IMAGE", "/stub/photo.png"), "rb").read()
GEONAMES_USER = os.environ.get("STUB_GEONAMES_USER", "e2e")
CITIES = [
    # (geonameId, nome italiano, nome locale/internazionale, regione, nazione, codice, lat, lng, abitanti[, fcode])
    (2657896, "Zurigo", "Zürich", "Zurigo", "Svizzera", "CH", 47.36667, 8.55, 341730),
    (2562305, "Żurrieq", "Żurrieq", "Malta", "Malta", "MT", 35.83, 14.47, 11000),
    (3169070, "Roma", "Rome", "Lazio", "Italia", "IT", 41.89193, 12.51133, 2318895),
    (2867714, "Monaco di Baviera", "Munich", "Baviera", "Germania", "DE", 48.13743, 11.57549, 1260391),
    (2993458, "Monaco", "Monaco", "Monaco", "Principato di Monaco", "MC", 43.73333, 7.41667, 32965),
    (2267057, "Lisbona", "Lisbon", "Lisbona", "Portogallo", "PT", 38.71667, -9.13333, 517802),
    (2660646, "Ginevra", "Geneva", "Ginevra", "Svizzera", "CH", 46.20222, 6.14569, 183981),
    # Casi reali che il backend deve scartare:
    # traslitterazione minuscola trovata per "zur" (Zliten, Libia)...
    (2208425, "zuriten", "Zliten", "Misurata", "Libia", "LY", 32.46738, 14.56685, 109972),
    # ...e un quartiere (PPLX) di Zurigo.
    (6295515, "Zürich (Kreis 11)", "Zürich (Kreis 11)", "Zurigo", "Svizzera", "CH", 47.42, 8.53, 75000, "PPLX"),
]
POIS = [
    # (osm_type, osm_id, osm_key, osm_value, nome, via, civico, cap, città, nazione, lat, lon)
    # Senza posizione l'ordine è questo: la Sagrada Familia di Sabadell viene prima di quella di Barcellona.
    ("W", 693532629, "amenity", "place_of_worship", "Sagrada Familia", "Illa Sacra", "", "08203", "Sabadell", "España", 41.53135, 2.12031),
    ("R", 9194723, "amenity", "place_of_worship", "Basílica de la Sagrada Família", "Carrer de Mallorca", "401", "08013", "Barcelona", "España", 41.40350, 2.17443),
    ("N", 3397396651, "railway", "stop", "Sagrada Família", "Carrer de la Marina", "", "08013", "Barcelona", "España", 41.40399, 2.17510),
    ("W", 25356963, "tourism", "attraction", "Casa Batlló", "Passeig de Gràcia", "43", "08007", "Barcelona", "España", 41.39164, 2.16494),
    ("W", 27354262, "tourism", "attraction", "Colosseo", "Piazza del Colosseo", "", "00184", "Roma", "Italia", 41.89021, 12.49223),
]
PHOTON_LANGS = {"default", "de", "en", "fr"}
state = {"searches": [], "downloads": [], "places": [], "poi": []}


def fold(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/__state":
            return self._json(200, state)
        if url.path.startswith("/img/"):
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(IMAGE)))
            self.end_headers()
            self.wfile.write(IMAGE)
            return
        if url.path == "/photon/api":
            params = parse_qs(url.query)
            q = params.get("q", [""])[0]
            lat, lon = params.get("lat", [None])[0], params.get("lon", [None])[0]
            lang = params.get("lang", [None])[0]
            state["poi"].append({"q": q, "lat": lat, "lon": lon, "lang": lang, "zoom": params.get("zoom", [None])[0],
                                 "userAgent": self.headers.get("User-Agent")})
            if lang is not None and lang not in PHOTON_LANGS:
                return self._json(400, {"lang": [{"message": "Language is not supported. Supported are: default, de, en, fr", "value": lang}]})
            if "offline" in q.lower():
                return self._json(503, {"message": "Service Unavailable"})
            hits = [p for p in POIS if fold(q) in fold(p[4]) or fold(q) in fold(p[5])]
            if lat is not None and lon is not None:
                hits.sort(key=lambda p: math.hypot(p[10] - float(lat), p[11] - float(lon)))
            limit = int(params.get("limit", ["15"])[0])
            return self._json(200, {"type": "FeatureCollection", "features": [{
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [p[11], p[10]]},
                "properties": {k: v for k, v in {
                    "osm_type": p[0], "osm_id": p[1], "osm_key": p[2], "osm_value": p[3], "type": "house",
                    "name": p[4], "street": p[5], "housenumber": p[6], "postcode": p[7], "city": p[8],
                    "country": p[9],
                }.items() if v != ""},
            } for p in hits[:limit]]})
        if url.path == "/searchJSON":
            params = parse_qs(url.query)
            if params.get("username", [""])[0] != GEONAMES_USER:
                # Come GeoNames: errore con HTTP 200 e oggetto "status".
                return self._json(200, {"status": {"message": "user account not enabled to use the free webservice.", "value": 10}})
            q = params.get("name_startsWith", [""])[0].lower()
            italian_only = params.get("searchlang", [""])[0] == "it"
            state["places"].append(q + (" [it]" if italian_only else ""))
            # searchlang=it: solo i nomi italiani (le traslitterazioni non sono "nomi italiani").
            hits = [c for c in CITIES if c[1].lower().startswith(q) and (not italian_only or c[1] != c[1].lower())
                    or (not italian_only and c[2].lower().startswith(q))]
            hits.sort(key=lambda c: -c[8])
            return self._json(200, {"totalResultsCount": len(hits), "geonames": [{
                "geonameId": c[0], "name": c[1], "toponymName": c[2], "adminName1": c[3],
                "countryName": c[4], "countryCode": c[5], "lat": str(c[6]), "lng": str(c[7]), "population": c[8],
                "fcode": c[9] if len(c) > 9 else "PPLA",
            } for c in hits]})
        if self.headers.get("Authorization") != f"Client-ID {KEY}":
            return self._json(401, {"errors": ["OAuth error: The access token is invalid"]})
        if url.path == "/search/photos":
            query = parse_qs(url.query).get("query", [""])[0]
            state["searches"].append(query)
            results = [{
                "id": f"stub{i}",
                "alt_description": f"{query} foto {i}",
                "urls": {"raw": f"{PUBLIC}/img/stub{i}?ixid=e2e"},
                "user": {"name": f"Fotografo {i}", "links": {"html": f"https://unsplash.com/@fotografo{i}"}},
                "links": {"download_location": f"{API}/photos/stub{i}/download?ixid=e2e"},
            } for i in range(1, 4)]
            return self._json(200, {"total": 3, "results": results})
        if url.path.startswith("/photos/") and url.path.endswith("/download"):
            state["downloads"].append(url.path.split("/")[2])
            return self._json(200, {"url": f"{PUBLIC}/img/x"})
        return self._json(404, {"errors": ["not found"]})

    def log_message(self, *args):
        pass


ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
