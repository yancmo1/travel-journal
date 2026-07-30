#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${ENV_FILE:-${project_dir}/.env.production}"
compose_file="${project_dir}/docker-compose.production.yml"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}. Copy .env.production.example and fill in every secret."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

required=(DATA_ROOT GHCR_OWNER APP_HOSTNAME POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD JWT_SECRET)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]] || [[ "${!name}" == replace_* ]]; then
    echo "Set ${name} in ${env_file}."
    exit 1
  fi
done

if [[ "${DATA_ROOT}" != /* ]]; then
  echo "DATA_ROOT must be an absolute host path."
  exit 1
fi

photo_uid="${PHOTO_UID:-1000}"
photo_gid="${PHOTO_GID:-1000}"

if [[ ! "${photo_uid}" =~ ^[0-9]+$ ]] || [[ ! "${photo_gid}" =~ ^[0-9]+$ ]]; then
  echo "PHOTO_UID and PHOTO_GID must be numeric."
  exit 1
fi

# The backend image runs as Node's unprivileged uid/gid 1000 by default.
install -d -o "${photo_uid}" -g "${photo_gid}" -m 0750 "${DATA_ROOT}/photos"
install -d -m 0750 "${DATA_ROOT}/postgres" "${DATA_ROOT}/postgres-dumps"

docker compose --env-file "${env_file}" -f "${compose_file}" pull
docker compose --env-file "${env_file}" -f "${compose_file}" up -d --remove-orphans
docker compose --env-file "${env_file}" -f "${compose_file}" ps

echo
echo "Local health check: curl --fail http://127.0.0.1:${LOCAL_HTTP_PORT:-3080}/api/health"
