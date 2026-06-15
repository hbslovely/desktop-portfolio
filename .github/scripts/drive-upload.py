#!/usr/bin/env python3
"""
Upload a file to Google Drive using a user OAuth2 refresh token.

This avoids the "Service Accounts do not have storage quota" error that
occurs when uploading to a regular My Drive folder with a service account.

Usage:
  python3 drive-upload.py <local-file> <mime-type> <file-name> <folder-id>

Required environment variables:
  GOOGLE_OAUTH_CLIENT_ID      — OAuth2 client ID (desktop/installed app type)
  GOOGLE_OAUTH_CLIENT_SECRET  — OAuth2 client secret
  GOOGLE_OAUTH_REFRESH_TOKEN  — Long-lived refresh token for the folder owner

Prints the uploaded file ID to stdout.
"""

import sys
import json
import os
import urllib.request
import urllib.parse
import urllib.error


def get_access_token() -> str:
    client_id     = os.environ["GOOGLE_OAUTH_CLIENT_ID"]
    client_secret = os.environ["GOOGLE_OAUTH_CLIENT_SECRET"]
    refresh_token = os.environ["GOOGLE_OAUTH_REFRESH_TOKEN"]

    data = urllib.parse.urlencode({
        "client_id":     client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            resp = json.load(r)
            if "access_token" not in resp:
                print(f"Token refresh failed: {resp}", file=sys.stderr)
                sys.exit(1)
            return resp["access_token"]
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"Token refresh HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def upload(local_path: str, mime_type: str, file_name: str, folder_id: str) -> str:
    token = get_access_token()

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    boundary = b"drive_report_boundary_abc123"
    metadata = json.dumps({"name": file_name, "parents": [folder_id]}).encode("utf-8")

    body = (
        b"--" + boundary + b"\r\n"
        b"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        + metadata + b"\r\n"
        b"--" + boundary + b"\r\n"
        + f"Content-Type: {mime_type}\r\n\r\n".encode()
        + file_bytes + b"\r\n"
        b"--" + boundary + b"--\r\n"
    )

    req = urllib.request.Request(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        data=body,
        method="POST",
        headers={
            "Authorization":  f"Bearer {token}",
            "Content-Type":   f"multipart/related; boundary={boundary.decode()}",
            "Content-Length": str(len(body)),
        },
    )

    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raw = e.read()
        decoded = raw.decode(errors="replace")
        print(f"Upload HTTP {e.code} {e.reason}", file=sys.stderr)
        print(f"Response: {decoded}", file=sys.stderr)
        sys.exit(1)

    if not raw or not raw.strip():
        print("ERROR: Drive API returned an empty response.", file=sys.stderr)
        sys.exit(1)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        print(f"ERROR: Response is not JSON: {raw.decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)

    if "error" in result:
        err = result["error"]
        print(f"Drive API error {err.get('code')}: {err.get('message')}", file=sys.stderr)
        sys.exit(1)

    file_id = result.get("id", "")
    print(f"Uploaded: {result.get('name')} | id: {file_id}")
    return file_id


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(
            "Usage: drive-upload.py <local-file> <mime-type> <file-name> <folder-id>",
            file=sys.stderr,
        )
        sys.exit(1)
    local_path, mime_type, file_name, folder_id = sys.argv[1:5]
    upload(local_path, mime_type, file_name, folder_id)
