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
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "The repository has uncommitted files; deployment stopped." >&2
  exit 1
fi

git fetch origin main
git merge --ff-only origin/main
"${compose[@]}" config --quiet
"${compose[@]}" build --pull api
"${compose[@]}" up -d --wait --wait-timeout 120 postgres
"${compose[@]}" run --rm --no-deps api npm run migrate:production
"${compose[@]}" up -d --remove-orphans --wait --wait-timeout 120
"${compose[@]}" ps
