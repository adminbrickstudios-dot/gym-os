import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO as OPCIONES_COOKIE } from "@/lib/cookie-gimnasio";
import { clasificarHost, normalizarHost } from "@/lib/host";
import { memoriaCorta } from "@/lib/rapidez/memoria";

// VD-47: qué gimnasio es cada dirección se recuerda 60 s en este servidor: la
// RPC se hace una vez por minuto, no en cada pedido. Un alta nueva aparece en <= 1 minuto.
type Resuelto = { gimnasio_id: string; slug: string; host?: string | null } | undefined;
const gimnasios = memoriaCorta<Resuelto>(60_000);

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
  // getClaims verifica el JWT en el servidor sin ir a Auth cuando el proyecto usa claves asimétricas
  // (con clave simétrica la propia librería cae a getUser). La base decide todo con auth.uid().
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub && esProtegida(ruta)) {
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

  const resolver = (funcion: "gimnasio_por_host" | "gimnasio_por_slug", args: Record<string, string>) =>
    gimnasios.obtener(`${funcion}:${Object.values(args)[0]}`, () => consultar(funcion, args));
  const consultar = async (funcion: "gimnasio_por_host" | "gimnasio_por_slug", args: Record<string, string>): Promise<Resuelto> => {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return ((await r.json()) as NonNullable<Resuelto>[])[0];
  };

  const clase = clasificarHost(host, base, plataforma);
  if (clase.tipo === "plataforma") {
    const ruta = req.nextUrl.pathname;
    type Elegido = { gimnasio_id: string; slug: string; host: string | null };
    const marcarGimnasio = (g: Elegido) => {
      // El host del gimnasio (no el de la plataforma): con él se busca su
      // página y su marca. Los permisos los valida cada función de la base.
      cabeceras.set("x-gymos-contexto", "gimnasio");
      cabeceras.set("x-gimnasio-id", g.gimnasio_id);
      cabeceras.set("x-gimnasio-slug", g.slug);
      cabeceras.set("x-gimnasio-host", g.host ?? host);
    };
    const porSlug = async (slug: string) => (await resolver("gimnasio_por_slug", { p_slug: slug })) as Elegido | undefined;

    // /g/<slug>: la página de un gimnasio que todavía no tiene dirección
    // propia. Queda elegido (cookie) para que "Soy socio" y /app sigan en él.
    const g = /^\/g\/([a-z0-9-]{1,42})(\/.*)?$/.exec(ruta);
    if (g) {
      let elegido: Elegido | undefined;
      try {
        elegido = await porSlug(g[1]);
      } catch (e) {
        return new NextResponse(`No se pudo resolver el gimnasio ${g[1]}: ${(e as Error).message}`, { status: 503 });
      }
      if (!elegido) {
        const destino = req.nextUrl.clone();
        destino.pathname = "/gimnasio-no-encontrado";
        destino.search = `?host=${encodeURIComponent(`${host}/g/${g[1]}`)}`;
        return NextResponse.rewrite(destino, { status: 404 });
      }
      const resto = g[2] && g[2] !== "/" ? g[2] : null;
      let r: NextResponse;
      if (resto) {
        const destino = req.nextUrl.clone();
        destino.pathname = resto;
        r = NextResponse.redirect(destino);
      } else {
        marcarGimnasio(elegido);
        const destino = req.nextUrl.clone();
        destino.pathname = "/";
        r = NextResponse.rewrite(destino, { request: { headers: cabeceras } });
      }
      r.cookies.set(COOKIE_GIMNASIO, elegido.slug, OPCIONES_COOKIE);
      return r;
    }

    // El panel, la app del socio y su ingreso también se usan desde la
    // dirección de la plataforma: el gimnasio sale de la cookie que se puso
    // al entrar. La cookie no da permisos.
    const socioIngresando = ruta === "/ingresar" && req.nextUrl.searchParams.get("modo") === "socio";
    // VD-22: /auth/* (Google: ir, volver y vincular) también son del gimnasio elegido.
    const delGimnasio = ruta === "/panel" || ruta.startsWith("/panel/") || ruta === "/app" || ruta.startsWith("/app/") || ruta.startsWith("/auth/");
    const slug = req.cookies.get(COOKIE_GIMNASIO)?.value;
    if (delGimnasio || (socioIngresando && slug)) {
      let elegido: Elegido | undefined;
      if (slug) {
        try {
          elegido = await porSlug(slug);
        } catch (e) {
          return new NextResponse(`No se pudo resolver el gimnasio ${slug}: ${(e as Error).message}`, { status: 503 });
        }
      }
      if (!elegido) {
        const destino = req.nextUrl.clone();
        destino.pathname = "/ingresar";
        destino.search = `?siguiente=${encodeURIComponent(ruta)}`;
        const r = NextResponse.redirect(destino);
        if (slug) r.cookies.delete(COOKIE_GIMNASIO);
        return r;
      }
      marcarGimnasio(elegido);
      return conSesion(req, cabeceras, supabaseUrl, anon);
    }
    cabeceras.set("x-gymos-contexto", "plataforma");
    return conSesion(req, cabeceras, supabaseUrl, anon);
  }

  if (req.nextUrl.pathname.startsWith("/gimnasio-no-encontrado")) {
    return NextResponse.next({ request: { headers: cabeceras } });
  }

  let gimnasio: { gimnasio_id: string; slug: string } | undefined;
  try {
    gimnasio = await resolver("gimnasio_por_host", { p_host: host });
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
  // Sin estáticos ni imágenes. /manifest.webmanifest SÍ pasa: lo arma cada gimnasio y necesita su dirección.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf|map)$).*)"],
};
