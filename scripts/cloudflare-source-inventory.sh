#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only inventory for the legacy Ubuntu deployment. Run this on ubuntumac
# from /opt/travel-journal before each migration rehearsal.

project_dir="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
env_file="${ENV_FILE:-${project_dir}/.env.production}"
compose_file="${project_dir}/docker-compose.production.yml"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

required=(DATA_ROOT POSTGRES_DB POSTGRES_USER)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Set ${name} in ${env_file}."
    exit 1
  fi
done

echo "environment=ubuntu-legacy"
echo "hostname=$(hostname)"
echo "compose_project=travel-journal"
echo "compose_file=${compose_file}"
echo "data_root=${DATA_ROOT}"

echo "container_revisions="
sudo docker compose --env-file "${env_file}" -f "${compose_file}" ps --format '{{.Service}}|{{.Image}}|{{.State}}|{{.Health}}'

echo "database_counts="
sudo docker compose --env-file "${env_file}" -f "${compose_file}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Atc \
  "SELECT 'users', count(*) FROM users;
   SELECT 'journeys', count(*) FROM journeys;
   SELECT 'photos', count(*) FROM photos;
   SELECT 'travelers', count(*) FROM travelers;
   SELECT 'trip_travelers', count(*) FROM trip_travelers;
   SELECT 'trips', count(*) FROM trips;"

echo "photo_files=$(sudo find "${DATA_ROOT}/photos" -type f | wc -l | tr -d ' ')"
echo "photo_bytes=$(sudo du -sb "${DATA_ROOT}/photos" | awk '{print $1}')"
echo "backup_status="
sudo cat "${DATA_ROOT}/maintenance/backup-status.json" 2>/dev/null || echo "unavailable"

