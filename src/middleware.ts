/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homePathForRole, requiresAal2, type AppRole } from "@/lib/auth/roles";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Parameters<typeof response.cookies.set>[2];
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isApi = pathname.startsWith("/api/");
  const isWebhook = pathname.startsWith("/api/webhooks/");
  const isCron = pathname.startsWith("/api/cron/");

  if (isWebhook || isCron) return response;

  if (!user && !isPublic && !isApi) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .schema("partner")
    .from("profiles")
    .select("role, is_emergency")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? null) as AppRole | null;

  if (pathname === "/login" || pathname === "/") {
    const dest = request.nextUrl.clone();
    dest.pathname = role ? homePathForRole(role) : "/login";
    dest.search = "";
    return NextResponse.redirect(dest);
  }

  // MFA: admin e nazionale richiedono aal2
  if (role && requiresAal2(role)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aal?.currentLevel !== "aal2" &&
      (pathname.startsWith("/admin") ||
        pathname.startsWith("/territories") ||
        pathname.startsWith("/statements") ||
        pathname.startsWith("/api/admin"));

    if (needsMfa && pathname !== "/login/mfa") {
      const mfa = request.nextUrl.clone();
      mfa.pathname = "/login/mfa";
      mfa.searchParams.set("next", pathname);
      return NextResponse.redirect(mfa);
    }
  }

  if (pathname.startsWith("/admin") && role && !["super_admin", "imment_admin"].includes(role)) {
    const forbidden = request.nextUrl.clone();
    forbidden.pathname = homePathForRole(role);
    return NextResponse.redirect(forbidden);
  }

  if (
    (pathname.startsWith("/territories") || pathname.startsWith("/statements")) &&
    role &&
    role !== "bac_nazionale" &&
    !["super_admin", "imment_admin"].includes(role)
  ) {
    const forbidden = request.nextUrl.clone();
    forbidden.pathname = homePathForRole(role);
    return NextResponse.redirect(forbidden);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
