#!/usr/bin/env bash
set -Eeuo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

required=(DATA_ROOT POSTGRES_DB POSTGRES_USER RESTIC_REPOSITORY RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY)
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

dump_dir="${DATA_ROOT}/postgres-dumps"
maintenance_dir="${DATA_ROOT}/maintenance"
maintenance_uid="${MAINTENANCE_UID:-${PHOTO_UID:-1000}}"
maintenance_gid="${MAINTENANCE_GID:-${PHOTO_GID:-1000}}"
stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
dump_path="${dump_dir}/travel-journal-${stamp}.sql.gz"
install -d -m 0750 "${dump_dir}"
install -d -o "${maintenance_uid}" -g "${maintenance_gid}" -m 0750 "${maintenance_dir}"

docker compose --env-file "${env_file}" -f "${compose_file}" exec -T postgres \
  pg_dump --clean --if-exists --no-owner --no-privileges \
  --username "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip -9 > "${dump_path}"

find "${dump_dir}" -type f -name '*.sql.gz' -mtime +14 -delete

restic() {
  docker run --rm \
    --env-file "${env_file}" \
    --volume "${DATA_ROOT}:/data:ro" \
    restic/restic:latest "$@"
}

if ! restic snapshots --no-lock >/dev/null 2>&1; then
  restic init
fi

restic backup /data/photos /data/postgres-dumps /data/maintenance --tag travel-journal
restic forget --keep-daily 7 --keep-weekly 5 --keep-monthly 12 --prune

photo_storage_bytes="$(du -sb "${DATA_ROOT}/photos" | awk '{print $1}')"
database_dump_bytes="$(stat -c '%s' "${dump_path}")"
status_tmp="${maintenance_dir}/backup-status.json.tmp"
cat >"${status_tmp}" <<EOF
{
  "lastSuccessfulBackupAt": "${stamp}",
  "lastDatabaseDumpAt": "${stamp}",
  "databaseDumpBytes": ${database_dump_bytes},
  "photoStorageBytes": ${photo_storage_bytes}
}
EOF
mv -f "${status_tmp}" "${maintenance_dir}/backup-status.json"
chown "${maintenance_uid}:${maintenance_gid}" "${maintenance_dir}/backup-status.json"
chmod 0640 "${maintenance_dir}/backup-status.json"

echo "R2 backup completed at ${stamp}."
