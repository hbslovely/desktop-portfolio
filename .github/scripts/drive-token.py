#!/usr/bin/env python3
"""
Generates a short-lived Google OAuth2 access token from a service account JSON key.

Usage:
  python3 drive-token.py <path-to-sa.json> <scope>

Prints the access token to stdout.
"""

import sys
import json
import time
import base64
import urllib.request
import urllib.parse

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

sa_file = sys.argv[1]
scope   = sys.argv[2] if len(sys.argv) > 2 else "https://www.googleapis.com/auth/drive.file"

with open(sa_file) as f:
    sa = json.load(f)

now = int(time.time())

header_b64 = base64.urlsafe_b64encode(
    b'{"alg":"RS256","typ":"JWT"}'
).rstrip(b"=").decode()

payload_b64 = base64.urlsafe_b64encode(
    json.dumps({
        "iss": sa["client_email"],
        "scope": scope,
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }).encode()
).rstrip(b"=").decode()

private_key = serialization.load_pem_private_key(
    sa["private_key"].encode(), password=None
)
sig = private_key.sign(
    f"{header_b64}.{payload_b64}".encode(),
    padding.PKCS1v15(),
    hashes.SHA256(),
)
sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()

jwt = f"{header_b64}.{payload_b64}.{sig_b64}"

data = urllib.parse.urlencode({
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "assertion": jwt,
}).encode()

req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
with urllib.request.urlopen(req) as r:
    print(json.load(r)["access_token"])
