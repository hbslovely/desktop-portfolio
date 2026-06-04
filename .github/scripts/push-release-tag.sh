#!/usr/bin/env bash
# Creates annotated tag on HEAD only when package.json matches expected VERSION.
set -euo pipefail

TAG="${1:?Usage: push-release-tag.sh <tag> <expected-version> [tag-message]}"
EXPECTED="${2:?expected package.json version required}"
MSG="${3:-Release ${TAG} (package.json ${EXPECTED})}"

ACTUAL="$(jq -r '.version' package.json)"
if [ "${ACTUAL}" != "${EXPECTED}" ]; then
  echo "::error::Refuse to tag ${TAG}: package.json is '${ACTUAL}', expected '${EXPECTED}'"
  exit 1
fi

APP_ACTUAL="$(grep -E "^export const APP_VERSION = " src/app/app-info.ts | sed -E "s/.*'([^']*)'.*/\1/")"
if [ "${APP_ACTUAL}" != "${EXPECTED}" ]; then
  echo "::error::Refuse to tag ${TAG}: app-info.ts is '${APP_ACTUAL}', expected '${EXPECTED}'"
  exit 1
fi

if git rev-parse "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists on $(git rev-parse refs/tags/${TAG})"
  exit 0
fi

SHA="$(git rev-parse HEAD)"
git tag -a "${TAG}" -m "${MSG}

package.json: ${EXPECTED}
commit: ${SHA}"

git push origin "refs/tags/${TAG}"
echo "Tagged ${TAG} at ${SHA} (package.json ${EXPECTED})"
