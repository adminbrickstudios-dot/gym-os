// WEB-05 · El favicon de un gimnasio SIN logo: un cuadrado con su color y sus iniciales (nunca el ícono de otro, nunca un hueco).
// Con logo, la página y el manifest usan el logo; esto es solo el respaldo, por dirección (host), con la marca ya resuelta.
import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { traerLanding } from "@/lib/landing";
import { textoSobre } from "@/lib/marca";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  const landing = host ? await traerLanding(host).catch(() => null) : null;
  const nombre = landing?.marca.nombre ?? "Base";
  const acento = landing?.marca.color_acento ?? "#2fbf5b";
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "B";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: acento, color: textoSobre(acento), fontSize: 104, fontWeight: 800, borderRadius: 40 }}>
        {iniciales}
      </div>
    ),
    { width: 192, height: 192, headers: { "cache-control": "public, max-age=300" } },
  );
}
