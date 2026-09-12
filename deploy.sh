#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production; copy .env.production.example and set the VM values." >&2
  exit 1
fi

compose=(docker compose --env-file .env.production -f compose.production.yml)

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Deployment must run from the main branch." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked files have uncommitted changes; deployment stopped." >&2
  exit 1
fi

"${compose[@]}" config --quiet
git fetch origin main
git merge --ff-only origin/main
"${compose[@]}" build --pull api
"${compose[@]}" run --rm --no-deps api npm run migrate:production
"${compose[@]}" up -d --remove-orphans api
"${compose[@]}" ps
