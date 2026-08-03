#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only legacy export. Run on ubuntumac from the deployed project directory
# during a migration rehearsal. It creates portable JSONL database snapshots and
# a checksummed media manifest; it never writes to PostgreSQL or Cloudflare.

project_dir="${PROJECT_DIR:-$(pwd)}"
env_file="${ENV_FILE:-${project_dir}/.env.production}"
output_dir="${OUTPUT_DIR:-${project_dir}/cloudflare-migration-export}"
compose_file="${COMPOSE_FILE:-${project_dir}/docker-compose.production.yml}"

if [[ ! -f "${env_file}" ]]; then
  echo "Missing ${env_file}." >&2
  exit 1
fi
if [[ ! -f "${compose_file}" ]]; then
  echo "Missing ${compose_file}." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

required=(DATA_ROOT POSTGRES_DB POSTGRES_USER)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Set ${name} in ${env_file}." >&2
    exit 1
  fi
done

mkdir -p "${output_dir}/database"
photo_root="${DATA_ROOT}/photos"

tables=(users households household_members invitations travelers journeys trips trip_travelers photos)
for table in "${tables[@]}"; do
  case "${table}" in
    households|household_members|invitations)
      # The legacy schema has no household model; these files are intentionally
      # emitted empty so the preparation step can make that mapping explicit.
      : > "${output_dir}/database/${table}.jsonl"
      ;;
    *)
      sudo docker compose --env-file "${env_file}" -f "${compose_file}" exec -T postgres \
        psql -X -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Atc \
        "SELECT row_to_json(source_row)::text FROM (SELECT * FROM ${table} ORDER BY 1) AS source_row;" \
        > "${output_dir}/database/${table}.jsonl"
      ;;
  esac
done

if [[ ! -d "${photo_root}" ]]; then
  echo "Missing photo root ${photo_root}." >&2
  exit 1
fi

{
  echo -e "source_path\tbytes\tsha256\tmime_type"
  sudo find "${photo_root}" -type f -not -path "${photo_root}/temp/*" -print0 \
    | while IFS= read -r -d '' file; do
        relative="${file#${photo_root}/}"
        bytes="$(sudo stat -c '%s' "${file}")"
        sha256="$(sudo sha256sum "${file}" | awk '{print $1}')"
        mime="$(sudo file --brief --mime-type "${file}")"
        printf '%s\t%s\t%s\t%s\n' "${relative}" "${bytes}" "${sha256}" "${mime}"
      done
} > "${output_dir}/media-manifest.tsv"

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "generated_at=${generated_at}"
  echo "source_hostname=$(hostname)"
  echo "data_root=${DATA_ROOT}"
  echo "photo_root=${photo_root}"
  echo "table_files=${#tables[@]}"
  echo "media_manifest=${output_dir}/media-manifest.tsv"
} > "${output_dir}/README.txt"

echo "Created read-only migration export at ${output_dir}."
