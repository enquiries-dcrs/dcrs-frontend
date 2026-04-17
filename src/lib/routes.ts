/**
 * Default in-app path after a successful sign-in. Use this from login handlers,
 * OAuth/magic-link callbacks, and middleware once auth is wired.
 */
export const POST_LOGIN_REDIRECT = "/dashboard" as const;
