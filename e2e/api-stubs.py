"""Finto Unsplash per i test e2e: stessa forma di risposta dell'API reale, nessuna rete esterna.

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
API = os.environ.get("API_URL", "http://unsplash-stub:8000")
IMAGE = open(os.environ.get("STUB_IMAGE", "/stub/photo.png"), "rb").read()
state = {"searches": [], "downloads": []}


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
