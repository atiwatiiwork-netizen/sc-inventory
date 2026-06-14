import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { WORKER_COOKIE } from "@/lib/auth-constants";

/**
 * Refreshes the admin's Supabase auth session on every request and guards the
 * /admin and /worker areas.
 *
 *  - /admin/*  requires a Supabase auth user (the administrator).
 *  - /worker/* (except the PIN login) requires the worker session cookie.
 *
 * If Supabase env vars are missing the app still runs; route guards simply
 * fall through so the project is viewable before credentials are configured.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  let user = null;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const result = await supabase.auth.getUser();
    user = result.data.user;
  }

  // --- admin guard ---
  if (path.startsWith("/admin") && path !== "/admin/login" && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin/login";
    return NextResponse.redirect(redirect);
  }
  // already signed in → skip the admin login page
  if (path === "/admin/login" && user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin";
    return NextResponse.redirect(redirect);
  }

  // --- worker guard ---
  const hasWorker = request.cookies.has(WORKER_COOKIE);
  if (path.startsWith("/worker") && path !== "/worker/login" && !hasWorker) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/worker/login";
    return NextResponse.redirect(redirect);
  }

  return response;
}
