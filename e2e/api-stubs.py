"""Finti servizi esterni per i test e2e (Unsplash e GeoNames): stessa forma di risposta delle API reali,
nessuna rete esterna.

GeoNames
GET  /searchJSON?name_startsWith=...&username=e2e -> città il cui nome italiano o locale inizia con il testo

Unsplash
GET  /search/photos?query=...   -> 3 foto (alt con la query), richiede "Authorization: Client-ID e2e-fake-key"
GET  /photos/<id>/download      -> registra il "download" (linee guida Unsplash)
GET  /img/<id>                  -> immagine PNG servita al browser
GET  /__state                   -> per i test: ricerche e download ricevuti
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

KEY = os.environ.get("STUB_KEY", "e2e-fake-key")
PUBLIC = os.environ.get("PUBLIC_URL", "http://127.0.0.1:18090")
API = os.environ.get("API_URL", "http://api-stubs:8000")
IMAGE = open(os.environ.get("STUB_IMAGE", "/stub/photo.png"), "rb").read()
GEONAMES_USER = os.environ.get("STUB_GEONAMES_USER", "e2e")
CITIES = [
    # (geonameId, nome italiano, nome locale/internazionale, regione, nazione, codice, lat, lng, abitanti)
    (2657896, "Zurigo", "Zürich", "Zurigo", "Svizzera", "CH", 47.36667, 8.55, 341730),
    (2562305, "Żurrieq", "Żurrieq", "Malta", "Malta", "MT", 35.83, 14.47, 11000),
    (3169070, "Roma", "Rome", "Lazio", "Italia", "IT", 41.89193, 12.51133, 2318895),
    (2867714, "Monaco di Baviera", "Munich", "Baviera", "Germania", "DE", 48.13743, 11.57549, 1260391),
    (2993458, "Monaco", "Monaco", "Monaco", "Principato di Monaco", "MC", 43.73333, 7.41667, 32965),
    (2267057, "Lisbona", "Lisbon", "Lisbona", "Portogallo", "PT", 38.71667, -9.13333, 517802),
    (2660646, "Ginevra", "Geneva", "Ginevra", "Svizzera", "CH", 46.20222, 6.14569, 183981),
]
state = {"searches": [], "downloads": [], "places": []}


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
        if url.path == "/searchJSON":
            params = parse_qs(url.query)
            if params.get("username", [""])[0] != GEONAMES_USER:
                # Come GeoNames: errore con HTTP 200 e oggetto "status".
                return self._json(200, {"status": {"message": "user account not enabled to use the free webservice.", "value": 10}})
            q = params.get("name_startsWith", [""])[0].lower()
            state["places"].append(q)
            hits = [c for c in CITIES if c[1].lower().startswith(q) or c[2].lower().startswith(q)]
            hits.sort(key=lambda c: -c[8])
            return self._json(200, {"totalResultsCount": len(hits), "geonames": [{
                "geonameId": c[0], "name": c[1], "toponymName": c[2], "adminName1": c[3],
                "countryName": c[4], "countryCode": c[5], "lat": str(c[6]), "lng": str(c[7]), "population": c[8],
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
