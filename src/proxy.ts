import { createServerClient } from "@supabase/ssr";
import { opcionesCookieSesion } from "@/lib/supabase/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO as OPCIONES_COOKIE } from "@/lib/cookie-gimnasio";
import { clasificarHost, normalizarHost } from "@/lib/host";
import { memoriaCorta } from "@/lib/rapidez/memoria";
import { accionDeGimnasio, direccionPropia, esDelGimnasioConSesion, leerRutaGimnasio, usaGimnasioElegido } from "@/lib/proxy-rutas";
import { rutaGimnasio, urlDeHost } from "@/lib/urls";
import { dominiosViejos } from "@/lib/dominios";
import { BLOQUES, REDIRECCION_BLOQUE } from "@/lib/panel/organizacion";
import { DESTINO } from "@/lib/panel/rutas";

// VD-47: qué gimnasio es cada dirección se recuerda 60 s en este servidor: la
// RPC se hace una vez por minuto, no en cada pedido. Un alta nueva aparece en <= 1 minuto.
type Resuelto = { gimnasio_id: string; slug: string; host?: string | null; modo?: string | null; semaforo?: boolean | null; organizacion?: boolean | null } | undefined;
const gimnasios = memoriaCorta<Resuelto>(60_000);
const slugsAnteriores = memoriaCorta<string | null>(60_000);

// Encabezados que solo pone este middleware. Si vienen del navegador se
// borran: nadie puede elegir su gimnasio mandando un header. x-gimnasio-estilo ya no se pone (Pista es el único estilo desde el 26/11),
// pero se sigue borrando si llega del navegador.
const CABECERAS = ["x-gymos-contexto", "x-gimnasio-id", "x-gimnasio-slug", "x-gimnasio-host", "x-gimnasio-estilo", "x-gimnasio-modo", "x-gimnasio-semaforo", "x-gimnasio-organizacion"] as const;



/**
 * Pase 2.0 · organización (26/11): con la llave pase_2_organizacion, la dirección vieja de una pantalla que pasó a ser pestaña lleva a su
 * pestaña (/panel/bloque/<entrada>?pestana=<sección>), con los mismos parámetros. Si la pantalla usaba ?pestana= para lo suyo, viaja como ?sub=.
 * Solo GET: un formulario o una acción del servidor no se redirigen. Sin la llave (o con una base vieja sin la columna), nada cambia.
 */
function aSuPestana(req: NextRequest, organizacion: boolean | null | undefined): NextResponse | null {
  if (organizacion !== true || req.method !== "GET") return null;
  const destino = REDIRECCION_BLOQUE[req.nextUrl.pathname];
  if (!destino) return null;
  const [ruta, consulta] = destino.split("?");
  const viejos = new URLSearchParams(req.nextUrl.search);
  const nuevos = new URLSearchParams(consulta);
  const propia = viejos.get("pestana");
  viejos.delete("pestana");
  if (propia) nuevos.set("sub", propia);
  viejos.forEach((v, k) => nuevos.append(k, v));
  const url = req.nextUrl.clone();
  url.pathname = ruta;
  url.search = `?${nuevos}`;
  return NextResponse.redirect(url, 307);
}

/**
 * Pase 2.0 · organización: /panel/bloque/<entrada>?pestana=<sección> se REESCRIBE por dentro a la pantalla de siempre de esa pestaña (la
 * dirección del navegador queda como pestaña). Así ninguna página junta el JS de todas las pantallas. Sin la llave, lleva (307) a la de siempre.
 * La ?sub= vuelve a ser la ?pestana= propia de la pantalla; una ?pestana= que no es del bloque (Configuración usa la suya) va tal cual a la primera.
 */
function pestanaDelBloque(req: NextRequest, organizacion: boolean | null | undefined): { ir?: NextResponse; reescribir?: URL } | null {
  const clave = /^\/panel\/bloque\/([a-z]+)$/.exec(req.nextUrl.pathname)?.[1];
  const bloque = clave ? BLOQUES.find((b) => b.clave === clave && b.pestanas.length > 1) : undefined;
  if (!bloque) return null;
  const destino = (seccion: string) => (seccion === "hoy" ? "/panel/hoy/lista" : seccion === "prospectos" ? "/panel/socios" : DESTINO[seccion as keyof typeof DESTINO]);
  const viejos = new URLSearchParams(req.nextUrl.search);
  if (organizacion !== true) {
    const url = req.nextUrl.clone();
    url.pathname = bloque.pestanas[0].seccion === "hoy" ? DESTINO.tareas : destino(bloque.pestanas[0].seccion);
    url.search = "";
    return { ir: NextResponse.redirect(url, 307) };
  }
  const pedida = viejos.get("pestana"), sub = viejos.get("sub");
  const elegida = bloque.pestanas.find((p) => p.seccion === pedida);
  const activa = elegida ?? (viejos.get("vista") === "interesados" ? bloque.pestanas.find((p) => p.seccion === "prospectos") : undefined) ?? bloque.pestanas[0];
  const nuevos = new URLSearchParams();
  viejos.forEach((v, k) => { if (k !== "pestana" && k !== "sub") nuevos.append(k, v); });
  if (sub) nuevos.set("pestana", sub);
  else if (pedida && !elegida) nuevos.set("pestana", pedida);
  if (activa.seccion === "prospectos") nuevos.set("vista", "interesados");
  const url = req.nextUrl.clone();
  url.pathname = destino(activa.seccion);
  url.search = nuevos.toString() ? `?${nuevos}` : "";
  return { reescribir: url };
}

// Rutas que piden sesión. El resto (landing, ingresar) es público.
const PROTEGIDAS = ["/panel", "/app", "/admin"];
const esProtegida = (ruta: string) => PROTEGIDAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

/**
 * Renueva la sesión de Supabase (cookies) y, en las rutas protegidas, manda
 * a /ingresar si no hay usuario. Patrón de @supabase/ssr: la respuesta lleva
 * las cookies nuevas y el pedido también, para que el servidor las vea.
 */
async function conSesion(req: NextRequest, cabeceras: Headers, supabaseUrl: string, anon: string, reescribir?: URL) {
  const ruta = req.nextUrl.pathname;
  // Pase 2.0 · organización: una pestaña se sirve reescribiendo por dentro a la pantalla de siempre (con la sesión renovada igual).
  const seguir = () => (reescribir ? NextResponse.rewrite(reescribir, { request: { headers: cabeceras } }) : NextResponse.next({ request: { headers: cabeceras } }));
  let respuesta = seguir();
  if (!esProtegida(ruta) && ruta !== "/ingresar") return respuesta;
  // ESC-02: la landing y el ingreso de alguien sin sesión no verifican nada (ahorra un getClaims por cada visita anónima).
  if (!esProtegida(ruta) && !req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return respuesta;

  const supabase = createServerClient(supabaseUrl, anon, {
    cookieOptions: opcionesCookieSesion(supabaseUrl),
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        cabeceras.set("cookie", req.headers.get("cookie") ?? "");
        respuesta = seguir();
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });
  // getClaims verifica el JWT en el servidor sin ir a Auth cuando el proyecto usa claves asimétricas
  // (con clave simétrica la propia librería cae a getUser). La base decide todo con auth.uid().
  let { data, error } = await supabase.auth.getClaims();
  // Un tropiezo del servicio de cuentas no es "sin sesión": se reintenta una vez y, si sigue, la página decide (nunca se echa a quien tiene sesión).
  if (!data?.claims?.sub && error && !/session.*missing|no.*session|not.*authenticated|jwt/i.test(error.message ?? "")) {
    await new Promise((r) => setTimeout(r, 200));
    ({ data, error } = await supabase.auth.getClaims());
    if (!data?.claims?.sub && error && esProtegida(ruta) && !/session.*missing|no.*session|not.*authenticated|jwt/i.test(error.message ?? "")) return respuesta;
  }
  if (!data?.claims?.sub && esProtegida(ruta)) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.search = `?siguiente=${encodeURIComponent(ruta + req.nextUrl.search)}${ruta.startsWith("/app") ? "&modo=socio" : ""}`;
    return NextResponse.redirect(destino);
  }
  return respuesta;
}

export async function proxy(req: NextRequest) {
  // F0.1: cuánto tarda el proxy (resolver gimnasio + sesión), a la vista en la cabecera Server-Timing.
  const t0 = performance.now();
  const r = await proxyInterno(req);
  r.headers.append("Server-Timing", `proxy;dur=${Math.round(performance.now() - t0)}`);
  return r;
}

async function proxyInterno(req: NextRequest) {
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

  // D1: una dirección vieja de la lista explícita (NEXT_PUBLIC_DOMINIOS_VIEJOS) va, con 308 permanente, a la plataforma nueva: misma ruta y mismos parámetros.
  const destinoPlataforma = normalizarHost(plataforma);
  if (destinoPlataforma && host !== destinoPlataforma && dominiosViejos().includes(host)) {
    return NextResponse.redirect(urlDeHost(destinoPlataforma, req.nextUrl.pathname + req.nextUrl.search), 308);
  }

  const clase = clasificarHost(host, base, plataforma);
  if (clase.tipo === "plataforma") {
    const ruta = req.nextUrl.pathname;
    type Elegido = { gimnasio_id: string; slug: string; host: string | null; modo?: string | null; semaforo?: boolean | null; organizacion?: boolean | null };
    const marcarGimnasio = (g: Elegido) => {
      // El host del gimnasio (no el de la plataforma): con él se busca su
      // página y su marca. Los permisos los valida cada función de la base.
      cabeceras.set("x-gymos-contexto", "gimnasio");
      cabeceras.set("x-gimnasio-id", g.gimnasio_id);
      cabeceras.set("x-gimnasio-slug", g.slug);
      cabeceras.set("x-gimnasio-host", g.host ?? host);
      cabeceras.set("x-gimnasio-modo", g.modo === "claro" ? "claro" : "oscuro");
      cabeceras.set("x-gimnasio-semaforo", g.semaforo === true ? "si" : "no");
      cabeceras.set("x-gimnasio-organizacion", g.organizacion === true ? "si" : "no");
    };
    // Si la función todavía no existe en la base (publicación a medias) o falla, es como si no hubiera slug anterior: sigue dando "no encontrado".
    const slugActualDe = (slug: string) =>
      slugsAnteriores.obtener(slug, async () => {
        try {
          const r = await fetch(`${supabaseUrl}/rest/v1/rpc/slug_actual_de`, {
            method: "POST",
            headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_slug: slug }),
            cache: "no-store",
          });
          if (!r.ok) return null;
          const v = await r.json();
          return typeof v === "string" ? v : null;
        } catch { return null; }
      });
    const porSlug = async (slug: string) => (await resolver("gimnasio_por_slug", { p_slug: slug })) as Elegido | undefined;

    // /g/<slug>: la página de un gimnasio que todavía no tiene dirección
    // propia. Queda elegido (cookie) para que "Soy socio" y /app sigan en él.
    const g = leerRutaGimnasio(ruta);
    if (g.tipo === "gimnasio") {
      let elegido: Elegido | undefined;
      try {
        elegido = await porSlug(g.slug);
      } catch (e) {
        return new NextResponse(`No se pudo resolver el gimnasio ${g.slug}: ${(e as Error).message}`, { status: 503 });
      }
      if (!elegido) {
        // Un slug que el gimnasio dejó (cambió de dirección): el QR impreso sigue andando, con 308 a la dirección actual y la misma ruta.
        const actual = await slugActualDe(g.slug);
        if (actual && actual !== g.slug) return NextResponse.redirect(urlDeHost(plataforma, rutaGimnasio(actual) + (g.resto ?? "") + req.nextUrl.search), 308);
        const destino = req.nextUrl.clone();
        destino.pathname = "/gimnasio-no-encontrado";
        destino.search = `?host=${encodeURIComponent(`${host}${rutaGimnasio(g.slug)}`)}`;
        return NextResponse.rewrite(destino, { status: 404 });
      }
      // H3: con dominio propio (o subdominio que ya anda) la dirección vieja /g/<slug>/… redirige a la nueva, con la misma ruta.
      // Sin dominio, /g/<slug>/… es la dirección buena y siempre anda (la del QR impreso).
      const propio = direccionPropia(elegido.host, { base, plataforma });
      if (propio) return NextResponse.redirect(urlDeHost(propio, (g.resto ?? "/") + req.nextUrl.search), 308);
      const que = accionDeGimnasio(g.resto);
      let r: NextResponse;
      if (que.accion === "publica") {
        // U0.1/PLAT-02 + H3: /g/<slug>/ingresar, /hacete-socio y /privacidad se quedan en esa dirección (no rebotan a la raíz de la
        // plataforma, donde se perdía el gimnasio): muestran ESE gimnasio. El gimnasio queda también en la cookie.
        marcarGimnasio(elegido);
        const destino = req.nextUrl.clone();
        destino.pathname = que.ruta;
        r = NextResponse.rewrite(destino, { request: { headers: cabeceras } });
      } else if (que.accion === "redirigir") {
        const destino = req.nextUrl.clone();
        destino.pathname = que.ruta;
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
    // H3: el alta, la privacidad y el ingreso del socio también salen con el gimnasio elegido (los links relativos de su página).
    const socioIngresando = usaGimnasioElegido(ruta, req.nextUrl.searchParams.get("modo"));
    // VD-22: /auth/* (Google: ir, volver y vincular) también son del gimnasio elegido.
    const delGimnasio = esDelGimnasioConSesion(ruta);
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
        if (!delGimnasio && ruta !== "/ingresar") {
          // /hacete-socio o /privacidad con una cookie que ya no apunta a nadie: la página dice que no hay gimnasio (nunca el de otro).
          cabeceras.set("x-gymos-contexto", "plataforma");
          return conSesion(req, cabeceras, supabaseUrl, anon);
        }
        const destino = req.nextUrl.clone();
        destino.pathname = "/ingresar";
        destino.search = `?siguiente=${encodeURIComponent(ruta)}`;
        const r = NextResponse.redirect(destino);
        if (slug) r.cookies.delete(COOKIE_GIMNASIO);
        return r;
      }
      marcarGimnasio(elegido);
      const aPestana = aSuPestana(req, elegido.organizacion);
      if (aPestana) return aPestana;
      const pb = pestanaDelBloque(req, elegido.organizacion);
      if (pb?.ir) return pb.ir;
      return conSesion(req, cabeceras, supabaseUrl, anon, pb?.reescribir);
    }
    cabeceras.set("x-gymos-contexto", "plataforma");
    return conSesion(req, cabeceras, supabaseUrl, anon);
  }

  if (req.nextUrl.pathname.startsWith("/gimnasio-no-encontrado")) {
    return NextResponse.next({ request: { headers: cabeceras } });
  }

  let gimnasio: { gimnasio_id: string; slug: string; modo?: string | null; semaforo?: boolean | null; organizacion?: boolean | null } | undefined;
  try {
    gimnasio = await resolver("gimnasio_por_host", { p_host: host });
  } catch (e) {
    // No es "no existe": es que no pudimos preguntar. Se dice así.
    return new NextResponse(`No se pudo resolver el gimnasio de ${host}: ${(e as Error).message}`, { status: 503 });
  }

  // D1: www.<dominio propio> va al dominio sin www (308), solo si ESE dominio es de un gimnasio. Si no, sigue dando "no encontrado".
  if (!gimnasio && host.startsWith("www.")) {
    const sinWww = host.slice(4);
    try {
      const g = await resolver("gimnasio_por_host", { p_host: sinWww });
      if (g) return NextResponse.redirect(urlDeHost(sinWww, req.nextUrl.pathname + req.nextUrl.search), 308);
    } catch (e) {
      return new NextResponse(`No se pudo resolver el gimnasio de ${host}: ${(e as Error).message}`, { status: 503 });
    }
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
  cabeceras.set("x-gimnasio-modo", gimnasio.modo === "claro" ? "claro" : "oscuro");
  // Pista Semáforo (24/11): la llave por gimnasio viaja con la dirección (sin un viaje más). Sin la columna (base vieja) es "no".
  cabeceras.set("x-gimnasio-semaforo", gimnasio.semaforo === true ? "si" : "no");
  // Pase 2.0 · organización (26/11): la llave también viaja con la dirección; con ella, la dirección vieja de una pestaña lleva a su pestaña.
  cabeceras.set("x-gimnasio-organizacion", gimnasio.organizacion === true ? "si" : "no");
  const aPestana = aSuPestana(req, gimnasio.organizacion);
  if (aPestana) return aPestana;
  const pb = pestanaDelBloque(req, gimnasio.organizacion);
  if (pb?.ir) return pb.ir;
  return conSesion(req, cabeceras, supabaseUrl, anon, pb?.reescribir);
}

export const config = {
  // Sin estáticos ni imágenes. /manifest.webmanifest SÍ pasa: lo arma cada gimnasio y necesita su dirección.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf|map)$).*)"],
};
