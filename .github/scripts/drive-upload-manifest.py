#!/usr/bin/env python3
"""
Reads reports/manifest.json, checks each file against Google Drive,
and uploads only files that don't already exist in the folder.

Required env vars:
  DRIVE_FOLDER_ID
  ACCESS_TOKEN          — short-lived OAuth2 access token
  FORCE                 — "true" to skip duplicate check and re-upload everything
  GITHUB_ENV            — path to GitHub env file (set automatically by Actions)

Optional env vars (used to refresh token if ACCESS_TOKEN expires mid-run):
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REFRESH_TOKEN
"""

import json
import os
import sys
import subprocess
import urllib.request
import urllib.parse
import urllib.error

FOLDER_ID    = os.environ["DRIVE_FOLDER_ID"]
FORCE        = os.environ.get("FORCE", "false").lower() == "true"
ACCESS_TOKEN = os.environ["ACCESS_TOKEN"]
GITHUB_ENV   = os.environ.get("GITHUB_ENV", "")


def file_exists_in_drive(name: str) -> bool:
    params = urllib.parse.urlencode({
        "q": f"name='{name}' and '{FOLDER_ID}' in parents and trashed=false",
        "fields": "files(id,name)",
    })
    req = urllib.request.Request(
        f"https://www.googleapis.com/drive/v3/files?{params}",
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            data = json.load(r)
        return len(data.get("files", [])) > 0
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"  Drive check HTTP {e.code} for '{name}': {body}", file=sys.stderr)
        return False


def upload_file(local_path: str, mime: str, file_name: str) -> bool:
    result = subprocess.run(
        [
            sys.executable,
            ".github/scripts/drive-upload.py",
            local_path, mime, file_name, FOLDER_ID,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print(f"  ✅ UPLOADED  {file_name}")
        if result.stdout.strip():
            print(f"              {result.stdout.strip()}")
        return True
    else:
        print(f"  ❌ ERROR     {file_name}", file=sys.stderr)
        print(f"              {result.stderr.strip()}", file=sys.stderr)
        return False


def main():
    with open("reports/manifest.json") as f:
        manifest = json.load(f)

    print(f"Manifest loaded: {len(manifest)} entries ({len(manifest) * 2} files total)\n")

    uploaded = skipped = errors = 0

    for item in manifest:
        files = [
            (item["mdPath"],  item["mdName"],  "text/markdown"),
            (item["pdfPath"], item["pdfName"], "application/pdf"),
        ]
        for local_path, file_name, mime in files:
            if not FORCE and file_exists_in_drive(file_name):
                print(f"  ⏭  SKIPPED   {file_name}")
                skipped += 1
                continue

            if upload_file(local_path, mime, file_name):
                uploaded += 1
            else:
                errors += 1

    print(f"\n{'─'*60}")
    print(f"Total entries : {len(manifest)}")
    print(f"Uploaded      : {uploaded} files")
    print(f"Skipped       : {skipped} files (already in Drive)")
    print(f"Errors        : {errors} files")

    if GITHUB_ENV:
        with open(GITHUB_ENV, "a") as f:
            f.write(f"REPORT_TOTAL={len(manifest)}\n")
            f.write(f"REPORT_UPLOADED={uploaded}\n")
            f.write(f"REPORT_SKIPPED={skipped}\n")
            f.write(f"REPORT_ERRORS={errors}\n")

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
