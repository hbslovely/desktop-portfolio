#!/usr/bin/env python3
"""
Upload a file to Google Drive using a service account.

Usage:
  python3 drive-upload.py <sa-json-path> <local-file> <mime-type> <file-name> <folder-id>

Prints the uploaded file ID to stdout.
"""

import sys
import json
import time
import base64
import urllib.request
import urllib.parse
import urllib.error

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


def get_token(sa_file: str, scope: str) -> str:
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
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)["access_token"]
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"Token fetch failed HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def upload(sa_file: str, local_path: str, mime_type: str, file_name: str, folder_id: str) -> str:
    token = get_token(sa_file, "https://www.googleapis.com/auth/drive.file")

    with open(local_path, "rb") as f:
        file_bytes = f.read()

    boundary = b"drive_upload_boundary_xyz"
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
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary.decode()}",
            "Content-Length": str(len(body)),
        },
    )

    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raw = e.read()
        decoded = raw.decode(errors="replace")
        print(f"HTTP {e.code} {e.reason}", file=sys.stderr)
        print(f"Response: {decoded}", file=sys.stderr)
        # Parse Drive error message if available
        try:
            err_json = json.loads(raw)
            msg = err_json.get("error", {}).get("message", "")
            status = err_json.get("error", {}).get("status", "")
            if status == "FORBIDDEN":
                print(
                    f"\nPermission denied. Make sure the service account has Editor access to folder '{folder_id}'.",
                    file=sys.stderr,
                )
            print(f"Drive error: {status} — {msg}", file=sys.stderr)
        except json.JSONDecodeError:
            pass
        sys.exit(1)

    if not raw or not raw.strip():
        print("ERROR: Drive API returned an empty response.", file=sys.stderr)
        print(
            f"Check that the service account has Editor access to Drive folder '{folder_id}'.",
            file=sys.stderr,
        )
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
    if len(sys.argv) < 6:
        print("Usage: drive-upload.py <sa-json> <local-file> <mime-type> <file-name> <folder-id>", file=sys.stderr)
        sys.exit(1)
    sa_file, local_path, mime_type, file_name, folder_id = sys.argv[1:6]
    upload(sa_file, local_path, mime_type, file_name, folder_id)
