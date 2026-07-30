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

install -d -m 0750 "${DATA_ROOT}/photos" "${DATA_ROOT}/postgres" "${DATA_ROOT}/postgres-dumps"

docker compose --env-file "${env_file}" -f "${compose_file}" pull
docker compose --env-file "${env_file}" -f "${compose_file}" up -d --remove-orphans
docker compose --env-file "${env_file}" -f "${compose_file}" ps

echo
echo "Local health check: curl --fail http://127.0.0.1:${LOCAL_HTTP_PORT:-3080}/api/health"
