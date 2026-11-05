// La imagen que aparece al compartir el link de la página (WhatsApp,
// Instagram, Facebook): nombre y frase del gimnasio con sus colores. Si el
// gimnasio tiene foto de portada, la página usa esa foto en vez de esta.
import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { traerLanding } from "@/lib/landing";
import { textoSobre, tonoDeFondo } from "@/lib/marca";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  const landing = host ? await traerLanding(host) : null;
  const nombre = landing?.marca.nombre ?? "Gym OS";
  const frase = landing?.publicada ? landing.portada.titulo : landing ? "Estamos armando nuestra página" : "El sistema para tu gimnasio";
  const fondo = landing?.marca.color_fondo ?? "#14161b";
  const acento = landing?.marca.color_acento ?? "#2fbf5b";
  const texto = tonoDeFondo(fondo) === "oscuro" ? "#f5f5f4" : "#1c1917";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: fondo, color: texto, padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, background: acento, color: textoSobre(acento), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800 }}>
            {nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
          </div>
          <div style={{ fontSize: 48, fontWeight: 800 }}>{nombre}</div>
        </div>
        <div style={{ fontSize: frase.length > 40 ? 76 : 96, fontWeight: 900, lineHeight: 1, letterSpacing: -2, maxWidth: 1000 }}>{frase}</div>
        <div style={{ display: "flex", height: 16, width: 240, borderRadius: 8, background: acento }} />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
