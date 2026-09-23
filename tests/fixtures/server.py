"""Deterministic external-service fixtures. Never forwards traffic to the internet."""
from __future__ import annotations

import argparse
import json
import select
import socket
import socketserver
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

EVENTS: list[dict] = []
LOCK = threading.Lock()


def record(event: dict) -> None:
    with LOCK:
        EVENTS.append(event)


class HTTPFixture(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def send(self, status=200, body=b"", content_type="application/json"):
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        if isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_CONNECT(self):
        # Mihomo HTTP nodes use CONNECT even for plain HTTP. Only our fixture
        # and the simulated IP lookup are allowed; no arbitrary relay/egress.
        host, _, port = self.path.rpartition(":")
        allowed = (host in {"127.0.0.1", "localhost"} and port == str(self.server.server_port)) or (host == "ip-api.com" and port == "80")
        if not allowed:
            self.send(502, {"error": "external target blocked by fixture"})
            self.close_connection = True
            return
        with socket.create_connection(("127.0.0.1", self.server.server_port), timeout=5) as target:
            self.send_response(200, "Connection established")
            self.end_headers()
            self.wfile.flush()
            try:
                while True:
                    ready, _, _ = select.select([self.connection, target], [], [], 10)
                    if not ready:
                        break
                    for source in ready:
                        data = source.recv(65536)
                        if not data:
                            return
                        (target if source is self.connection else self.connection).sendall(data)
            except (OSError, TimeoutError):
                pass
            finally:
                self.close_connection = True

    def do_HEAD(self):
        if urlsplit(self.path).path == "/slow":
            time.sleep(3)
        self.send(204)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/health":
            return self.send(200, {"ok": True, "fixture": "nodeplane"})
        if path == "/events":
            with LOCK:
                events = list(EVENTS)
            return self.send(200, {"events": events})
        if path == "/subscription.yaml":
            port = self.server.server_port
            yaml = f'proxies:\n  - {{name: "Fixture Alpha", type: http, server: 127.0.0.1, port: {port}}}\n  - {{name: "Fixture Beta", type: http, server: localhost, port: {port}}}\n'
            return self.send(200, yaml, "text/yaml")
        if path == "/broken.yaml":
            return self.send(200, "not a proxy subscription", "text/plain")
        if path == "/fail":
            return self.send(503, {"error": "intentional fixture failure"})
        if path in {"/download", "/__down"}:
            return self.send(200, b"x" * (512 * 1024), "application/octet-stream")
        if path.startswith("/json"):
            return self.send(200, {"query": "192.0.2.10", "countryCode": "US"})
        if path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/platform")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if path == "/platform":
            return self.send(200, {"status": "available", "region": "US"})
        return self.send(404, {"error": "unknown fixture endpoint"})

    def do_POST(self):
        payload = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        path = urlsplit(self.path).path
        if path in {"/__up", "/upload"}:
            record({"type": "upload", "bytes": len(payload)})
            return self.send(200, {"received": len(payload)})
        if path == "/hook":
            try:
                body = json.loads(payload)
            except (ValueError, UnicodeError):
                body = payload.decode(errors="replace")
            record({"type": "webhook", "payload": body, "test_header": self.headers.get("X-NodePlane-Test")})
            return self.send(200, {"ok": True})
        if path == "/fail":
            return self.send(503, {"error": "intentional fixture failure"})
        return self.send(404, {"error": "unknown fixture endpoint"})


class SMTPFixture(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(10)
        self.wfile.write(b"220 localhost NodePlane test SMTP\r\n")
        data_mode = False
        message: list[bytes] = []
        while line := self.rfile.readline(65536):
            if data_mode:
                if line == b".\r\n":
                    record({"type": "email", "message": b"".join(message).decode(errors="replace")})
                    self.wfile.write(b"250 accepted\r\n")
                    data_mode = False
                else:
                    message.append(line)
                continue
            cmd = line.split(b" ", 1)[0].strip().upper()
            if cmd in {b"EHLO", b"HELO"}:
                self.wfile.write(b"250 localhost\r\n")
            elif cmd == b"DATA":
                data_mode = True
                message = []
                self.wfile.write(b"354 send message\r\n")
            elif cmd == b"QUIT":
                self.wfile.write(b"221 goodbye\r\n")
                break
            else:
                self.wfile.write(b"250 OK\r\n")


class SMTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18081)
    parser.add_argument("--smtp-port", type=int, default=18082)
    args = parser.parse_args()
    smtp = SMTPServer(("127.0.0.1", args.smtp_port), SMTPFixture)
    threading.Thread(target=smtp.serve_forever, daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), HTTPFixture)
    print(f"NodePlane fixtures: HTTP/proxy {args.port}; SMTP {args.smtp_port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        smtp.shutdown()
        smtp.server_close()
