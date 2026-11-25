#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_HOST:?defina STAGING_HOST, ex.: ubuntu@1.2.3.4}"
: "${STAGING_DOMAIN:?defina STAGING_DOMAIN}"

ssh "$STAGING_HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/argos
git fetch origin main
git reset --hard origin/main
export GIT_COMMIT="$(git rev-parse --short HEAD)"
docker compose -f infra/staging/compose.yaml --env-file infra/staging/.env up -d --build
docker image prune -f
REMOTE

expected="$(ssh "$STAGING_HOST" 'cd /opt/argos && git rev-parse --short HEAD')"
for _ in $(seq 1 30); do
  body="$(curl -fsS "https://$STAGING_DOMAIN/v1/health" || true)"
  if [[ "$body" == *"\"version\":\"$expected\""* ]]; then
    echo "ok: $body"
    exit 0
  fi
  sleep 5
done
echo "falhou: o health não respondeu a versão $expected a tempo" >&2
exit 1
