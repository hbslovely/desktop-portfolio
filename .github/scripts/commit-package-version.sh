#!/usr/bin/env bash
# Sets package.json (and package-lock.json) to exact VERSION, commits & pushes if needed.
# Fails if HEAD does not match VERSION after this step.
set -euo pipefail

VERSION="${1:?Usage: commit-package-version.sh <version> <commit-message> <branch>}"
MSG="${2:?commit message required}"
BRANCH="${3:?branch required}"

jq --arg v "${VERSION}" '.version = $v' package.json > package.json.tmp
mv package.json.tmp package.json

if [ -f package-lock.json ]; then
  jq --arg v "${VERSION}" '.version = $v' package-lock.json > package-lock.json.tmp
  mv package-lock.json.tmp package-lock.json
fi

ACTUAL="$(jq -r '.version' package.json)"
if [ "${ACTUAL}" != "${VERSION}" ]; then
  echo "::error::Failed to set package.json to ${VERSION} (got ${ACTUAL})"
  exit 1
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add package.json
if [ -f package-lock.json ]; then
  git add package-lock.json
fi

if ! git diff --staged --quiet; then
  git commit -m "${MSG}"
  git push origin "HEAD:${BRANCH}"
  echo "Committed and pushed package.json version ${VERSION}"
else
  echo "package.json already ${VERSION} at HEAD — no new commit"
fi

ACTUAL="$(jq -r '.version' package.json)"
if [ "${ACTUAL}" != "${VERSION}" ]; then
  echo "::error::HEAD package.json must be ${VERSION} before tagging (got ${ACTUAL})"
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "version_sha=$(git rev-parse HEAD)" >> "${GITHUB_OUTPUT}"
fi
