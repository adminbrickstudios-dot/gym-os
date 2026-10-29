import { NextResponse, type NextRequest } from "next/server";
import { clasificarHost, normalizarHost } from "@/lib/host";

// Encabezados que solo pone este middleware. Si vienen del navegador se
// borran: nadie puede elegir su gimnasio mandando un header.
const CABECERAS = ["x-gymos-contexto", "x-gimnasio-id", "x-gimnasio-slug", "x-gimnasio-host"] as const;

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
    return NextResponse.next({ request: { headers: cabeceras } });
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
  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
