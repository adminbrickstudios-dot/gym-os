import { NextResponse, type NextRequest } from "next/server";
import { origenDe } from "@/lib/urls";
import { COOKIE_TV } from "../cookie";

/** El link que se abre una vez en la TV: guarda el token en una cookie (la ve solo el servidor) y lo saca de la dirección. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const origen = origenDe(req.headers);
  const destino = new URL("/tv", origen);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    destino.searchParams.set("error", "link");
    return NextResponse.redirect(destino);
  }
  const r = NextResponse.redirect(destino);
  r.cookies.set(COOKIE_TV, token, { httpOnly: true, secure: origen.startsWith("https"), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 400 });
  return r;
}
