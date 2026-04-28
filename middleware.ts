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

  // /admin 은 관리자만 접근 가능
  if (pathname.startsWith("/admin")) {
    const user = process.env.ADMIN_BASIC_USER ?? "";
    const pass = process.env.ADMIN_BASIC_PASS ?? "";

    // 환경변수가 없으면 잠금 유지(실수로 공개 방지)
    if (!user || !pass) return unauthorized();

    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) return unauthorized();

    try {
      const b64 = auth.slice("Basic ".length);
      const decoded = Buffer.from(b64, "base64").toString("utf8");
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
  matcher: ["/admin/:path*"]
};

