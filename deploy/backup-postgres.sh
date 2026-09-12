#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production; run this script from a configured deployment." >&2
  exit 1
fi

backup_dir="${1:-$project_dir/backups/postgres}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$backup_dir/assistlink-$timestamp.dump"
partial_path="$backup_path.partial"
compose=(docker compose --env-file .env.production -f compose.production.yml)

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
trap 'rm -f "$partial_path"' EXIT

"${compose[@]}" exec -T postgres \
  pg_dump --username assistlink --dbname assistlink --format=custom --no-owner \
  > "$partial_path"
chmod 600 "$partial_path"
mv "$partial_path" "$backup_path"
trap - EXIT

echo "PostgreSQL backup created: $backup_path"
echo "Copy this file to encrypted storage outside the VM."
