import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clasificarHost, normalizarHost } from "@/lib/host";

// Encabezados que solo pone este middleware. Si vienen del navegador se
// borran: nadie puede elegir su gimnasio mandando un header.
const CABECERAS = ["x-gymos-contexto", "x-gimnasio-id", "x-gimnasio-slug", "x-gimnasio-host"] as const;

// Rutas que piden sesión. El resto (landing, ingresar) es público.
const PROTEGIDAS = ["/panel", "/app", "/admin"];
const esProtegida = (ruta: string) => PROTEGIDAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

/**
 * Renueva la sesión de Supabase (cookies) y, en las rutas protegidas, manda
 * a /ingresar si no hay usuario. Patrón de @supabase/ssr: la respuesta lleva
 * las cookies nuevas y el pedido también, para que el servidor las vea.
 */
async function conSesion(req: NextRequest, cabeceras: Headers, supabaseUrl: string, anon: string) {
  const ruta = req.nextUrl.pathname;
  let respuesta = NextResponse.next({ request: { headers: cabeceras } });
  if (!esProtegida(ruta) && ruta !== "/ingresar") return respuesta;

  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        cabeceras.set("cookie", req.headers.get("cookie") ?? "");
        respuesta = NextResponse.next({ request: { headers: cabeceras } });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && esProtegida(ruta)) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.search = `?siguiente=${encodeURIComponent(ruta + req.nextUrl.search)}${ruta.startsWith("/app") ? "&modo=socio" : ""}`;
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export async function middleware(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_DOMINIO_BASE;
  const plataforma = process.env.NEXT_PUBLIC_DOMINIO_PLATAFORMA;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !plataforma || !supabaseUrl || !anon) {
    return new NextResponse(
      "Falta configurar NEXT_PUBLIC_DOMINIO_BASE, NEXT_PUBLIC_DOMINIO_PLATAFORMA, NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      { status: 500 }
    );
  }

  const host = normalizarHost(req.headers.get("host"));
  const cabeceras = new Headers(req.headers);
  CABECERAS.forEach((c) => cabeceras.delete(c));

  const clase = clasificarHost(host, base, plataforma);
  if (clase.tipo === "plataforma") {
    cabeceras.set("x-gymos-contexto", "plataforma");
    return conSesion(req, cabeceras, supabaseUrl, anon);
  }

  if (req.nextUrl.pathname.startsWith("/gimnasio-no-encontrado")) {
    return NextResponse.next({ request: { headers: cabeceras } });
  }

  let gimnasio: { gimnasio_id: string; slug: string } | undefined;
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/gimnasio_por_host`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_host: host }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    [gimnasio] = (await r.json()) as { gimnasio_id: string; slug: string }[];
  } catch (e) {
    // No es "no existe": es que no pudimos preguntar. Se dice así.
    return new NextResponse(`No se pudo resolver el gimnasio de ${host}: ${(e as Error).message}`, { status: 503 });
  }

  if (!gimnasio) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/gimnasio-no-encontrado";
    destino.search = `?host=${encodeURIComponent(host)}`;
    return NextResponse.rewrite(destino, { status: 404 });
  }

  cabeceras.set("x-gymos-contexto", "gimnasio");
  cabeceras.set("x-gimnasio-id", gimnasio.gimnasio_id);
  cabeceras.set("x-gimnasio-slug", gimnasio.slug);
  cabeceras.set("x-gimnasio-host", host);
  return conSesion(req, cabeceras, supabaseUrl, anon);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
