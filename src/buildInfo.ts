// What this page was built from. The server reports its own via GET /api/health.
export const BUILD = {
  version: __APP_VERSION__,
  commit: __GIT_SHA__,
  builtAt: __BUILT_AT__,
} as const;
