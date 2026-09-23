#!/usr/bin/env bash
# Normalize image repository paths, not case-sensitive version tags.
set -euo pipefail
export LC_ALL=C
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${GITHUB_EVENT_NAME:?GITHUB_EVENT_NAME is required}"
: "${GITHUB_REF:?GITHUB_REF is required}"
repository="${GITHUB_REPOSITORY,,}"
registry="${REGISTRY:-ghcr.io}"
component='[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*'
if [[ ! "$repository" =~ ^${component}/${component}$ ]]; then
  echo 'Invalid owner/repository for a container image' >&2; exit 1
fi
if [[ ! "$registry" =~ ^[a-z0-9][a-z0-9.-]*(:[0-9]+)?$ ]]; then
  echo 'Invalid container registry' >&2; exit 1
fi
if [[ ! "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full GitHub commit SHA' >&2; exit 1
fi
publish=false
release_tag="ci-${GITHUB_SHA:0:12}"
if [[ "$GITHUB_EVENT_NAME" == push && "$GITHUB_REF" == refs/heads/main ]]; then
  publish=true; release_tag=latest
elif [[ "$GITHUB_EVENT_NAME" == push && "$GITHUB_REF" == refs/tags/v*.*.* ]]; then
  publish=true; release_tag="${GITHUB_REF#refs/tags/}"
fi
if [[ ! "$release_tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo 'Invalid container release tag' >&2; exit 1
fi
printf 'backend_image=%s/%s\n' "$registry" "$repository"
printf 'frontend_image=%s/%s-frontend\n' "$registry" "$repository"
printf 'migrator_image=%s/%s-migrator\n' "$registry" "$repository"
printf 'sha_tag=%s\n' "$GITHUB_SHA"
printf 'release_tag=%s\n' "$release_tag"
printf 'publish=%s\n' "$publish"
