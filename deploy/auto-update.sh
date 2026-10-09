#!/usr/bin/env bash
# Pull-based auto deploy: when origin/main has new commits, fast-forward and rebuild.
# Run from cron on the server, e.g. every 5 minutes (see README):
#   */5 * * * * bash /opt/checkin/deploy/auto-update.sh >> /var/log/checkin-update.log 2>&1
#
# Safe by design:
#  - one run at a time (flock)
#  - fast-forward only, and never touches a working tree with local changes
#  - checks /api/health after the rebuild and rolls back to the previous commit if it fails
#  - a commit that failed is remembered and not retried until origin/main moves on
#  - all logic lives in main(), so bash has read the whole script before `git merge`
#    can replace this very file with a newer version mid-run
set -u

main() {
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  BRANCH="${DEPLOY_BRANCH:-main}"
  FAILED_FILE="${DEPLOY_STATE_FILE:-/var/tmp/checkin-deploy-failed}"
  BUILD_LOG="${DEPLOY_BUILD_LOG:-/var/log/checkin-update-build.log}"   # docker output, overwritten each run
  cd "$REPO" || exit 1

  log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

  exec 9>"${DEPLOY_LOCK_FILE:-/var/lock/checkin-update.lock}"
  flock -n 9 || exit 0   # previous run still going

  git fetch --quiet origin "$BRANCH" || { log "fetch failed"; exit 1; }
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse "origin/$BRANCH")"
  [ "$LOCAL" = "$REMOTE" ] && exit 0                                   # nothing new
  [ -f "$FAILED_FILE" ] && [ "$(cat "$FAILED_FILE")" = "$REMOTE" ] && exit 0   # already failed once

  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "skip: local changes in $REPO, not touching them"
    exit 1
  fi

  log "update ${LOCAL:0:7} -> ${REMOTE:0:7}"
  git merge --ff-only --quiet "origin/$BRANCH" || { log "skip: cannot fast-forward"; exit 1; }

  PORT="$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"' )"
  PORT="${PORT:-3010}"

  healthy() {
    for _ in $(seq 1 30); do
      curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 && return 0
      sleep 2
    done
    return 1
  }

  # keep the cron log short: build chatter goes to $BUILD_LOG, only its tail is shown on failure
  build() { docker compose up -d --build >"$BUILD_LOG" 2>&1; }

  if build && healthy; then
    rm -f "$FAILED_FILE"
    docker image prune -f >/dev/null 2>&1
    log "ok: now at $(git rev-parse --short HEAD)"
    exit 0
  fi

  log "FAILED at ${REMOTE:0:7}, rolling back to ${LOCAL:0:7}"
  tail -n 15 "$BUILD_LOG" 2>/dev/null | sed 's/^/    | /'
  echo "$REMOTE" > "$FAILED_FILE"
  git reset --hard --quiet "$LOCAL"
  build && healthy && log "rolled back, app healthy" || log "ROLLBACK ALSO FAILED: see $BUILD_LOG and 'docker compose logs app'"
  exit 1
}

main "$@"
exit $?
