import { NextResponse } from "next/server";
import { POST_LOGIN_REDIRECT } from "@/lib/routes";

/**
 * OAuth / magic-link redirect_uri target. Sends users to POST_LOGIN_REDIRECT,
 * or to ?next=/safe/path when the provider appends it (must be same-origin relative).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : POST_LOGIN_REDIRECT;
  return NextResponse.redirect(new URL(destination, url.origin));
}
