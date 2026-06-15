#!/usr/bin/env python3
"""
Get a short-lived Google OAuth2 access token from a refresh token.
Reads credentials from environment variables and prints the access token.

Required env vars:
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REFRESH_TOKEN
"""

import os
import json
import sys
import urllib.request
import urllib.parse
import urllib.error

data = urllib.parse.urlencode({
    "client_id":     os.environ["GOOGLE_OAUTH_CLIENT_ID"],
    "client_secret": os.environ["GOOGLE_OAUTH_CLIENT_SECRET"],
    "refresh_token": os.environ["GOOGLE_OAUTH_REFRESH_TOKEN"],
    "grant_type":    "refresh_token",
}).encode()

req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data)
try:
    with urllib.request.urlopen(req) as r:
        resp = json.load(r)
        if "access_token" not in resp:
            print(f"Token refresh failed: {resp}", file=sys.stderr)
            sys.exit(1)
        print(resp["access_token"])
except urllib.error.HTTPError as e:
    body = e.read().decode(errors="replace")
    print(f"Token refresh HTTP {e.code}: {body}", file=sys.stderr)
    sys.exit(1)
