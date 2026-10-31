#!/usr/bin/env python3
"""
MT Nexus Global ERP — Safe Local Static File Server
Serves static frontend assets while preventing exposure of server secrets,
environment files, database dumps, and internal documentation over HTTP.
"""

import http.server
import socketserver
import os
import sys

PORT = 8000
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# Explicitly forbidden route prefixes
BLOCKED_PREFIXES = (
    '/server',
    '/.secrets',
    '/backups',
    '/.git',
    '/node_modules',
)

# Explicitly forbidden file extensions
BLOCKED_EXTENSIONS = (
    '.env',
    '.sql',
    '.tar.gz',
    '.bak',
    '.key',
)

class SafeStaticRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _is_blocked(self, path):
        clean_path = path.split('?')[0].split('#')[0]
        # Check blocked directory prefixes
        for prefix in BLOCKED_PREFIXES:
            if clean_path == prefix or clean_path.startswith(prefix + '/'):
                return True
        # Check blocked file extensions
        for ext in BLOCKED_EXTENSIONS:
            if clean_path.endswith(ext):
                return True
        return False

    def do_GET(self):
        if self._is_blocked(self.path):
            self.send_error(403, "Access Denied: Protected System Resource")
            return
        return super().do_GET()

    def do_HEAD(self):
        if self._is_blocked(self.path):
            self.send_error(403, "Access Denied: Protected System Resource")
            return
        return super().do_HEAD()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    print(f"🔒 MT Nexus Global Safe Static Server initialized.")
    print(f"📁 Serving root: {BASE_DIR}")
    print(f"🌐 Available at: http://localhost:{PORT}")
    with socketserver.TCPServer(("", PORT), SafeStaticRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
