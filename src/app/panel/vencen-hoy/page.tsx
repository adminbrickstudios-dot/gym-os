import type { Metadata } from "next";
import Link from "next/link";
import { FilaContacto } from "@/components/panel/FilaContacto";
import { Vacio } from "@/components/ui/Vacio";
import { rutaDisponible } from "@/lib/panel/secciones";
import { Encabezado } from "@/components/panel/Marco";
import { fechaCorta } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { linkWhatsappSocio } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Vencen hoy" };
type Fila = { socio_id: string; nombre: string; telefono: string | null; texto: string; ultimo_ingreso: string | null; ultimo_contacto_en: string | null; ultimo_contacto_por: string | null; mensaje: string | null };

export default async function VencenHoy() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "vencen_hoy");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const filas = await rpc<Fila[]>("vencen_hoy", { p_gimnasio_id: panel.gimnasio.id });
    const zona = panel.gimnasio.zona_horaria;
    const puedeCobrar = rutaDisponible("/panel/vender", panel.yo.rol, panel.secciones_apagadas) && panel.cobra.membresia;
    return (
      <>
        <Encabezado emoji="⏰" titulo="Vencen hoy" bajada={filas.length
          ? `${filas.length === 1 ? "A 1 socio se le termina" : `A ${filas.length} socios se les termina`} la cuota hoy. Un mensaje ahora evita que se vayan; si vienen, cobrales desde acá.`
          : "Hoy es su último día cubierto. Un mensaje ahora evita que se vayan."} />
        {filas.length === 0 ? (
          <Vacio emoji="🎉" titulo="Hoy no vence nadie">
            {rutaDisponible("/panel/retencion", panel.yo.rol, panel.secciones_apagadas)
              ? <>Los que vencen en los próximos días están en <Link href="/panel/retencion?lista=por_vencer" className="underline">Retención → Vence pronto</Link>.</>
              : "Mañana se vuelve a calcular solo."}
          </Vacio>
        ) : (
          <ul className="space-y-2">
            {filas.map((f) => (
              <FilaContacto key={f.socio_id} socioId={f.socio_id} nombre={f.nombre} texto={f.texto} lista="por_vencer"
                detalle={f.ultimo_ingreso ? `Vino por última vez el ${fechaCorta(f.ultimo_ingreso, zona)}` : "Nunca vino"}
                whatsapp={linkWhatsappSocio(f.telefono, f.mensaje)}
                ultimo={f.ultimo_contacto_en ? `Le escribió ${f.ultimo_contacto_por ?? "alguien"} el ${fechaCorta(f.ultimo_contacto_en, zona)}` : null}
                puedeAnotar={panel.yo.rol !== "recepcion"} cobrar={puedeCobrar} />
            ))}
          </ul>
        )}
      </>
    );
  });
}
