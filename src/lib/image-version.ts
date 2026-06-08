/**
 * Cache-busting version for processed bike images (`/api/bike-img/*`).
 *
 * Images are served with a 24h browser cache. Bump this whenever the
 * background-knockout algorithm changes so clients refetch the new render
 * instead of showing a stale cached one. The `v` query param is otherwise
 * ignored by the route.
 */
export const IMAGE_KNOCKOUT_VERSION = "2";
