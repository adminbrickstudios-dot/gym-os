import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_TABLET } from "../cookie";

/** El link que el dueño abre en la tablet: guarda el token en una cookie (la ve solo el servidor) y lo saca de la dirección. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  // A la misma dirección del gimnasio (req.url puede venir con el host interno).
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const destino = new URL(`${proto}://${host}/kiosco`);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    destino.searchParams.set("error", "link");
    return NextResponse.redirect(destino);
  }
  const r = NextResponse.redirect(destino);
  r.cookies.set(COOKIE_TABLET, token, { httpOnly: true, secure: proto === "https", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  return r;
}
