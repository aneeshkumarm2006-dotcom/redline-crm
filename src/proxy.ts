import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/modules/auth/session";

export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-store");
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}
// All staff routes live under (crm)/crm. Public inventory and booking stay open.
export const config = { matcher: ["/crm/:path*"] };
