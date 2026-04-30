import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": "Basic realm=\"Admin\""
    }
  });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect /admin and /api/admin/* with Basic Auth
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    const user = process.env.ADMIN_BASIC_USER ?? "";
    const pass = process.env.ADMIN_BASIC_PASS ?? "";

    if (!user || !pass) return unauthorized();

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return unauthorized();

    try {
      const b64 = auth.slice("Basic ".length);
      // Edge Runtime: Buffer is unavailable.
      const decoded = atob(b64);
      const idx = decoded.indexOf(":");
      if (idx < 0) return unauthorized();

      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u !== user || p !== pass) return unauthorized();
    } catch {
      return unauthorized();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"]
};

