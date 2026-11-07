// VD-56 · El recibo y su texto para compartir. Los montos, la fecha y el número los arma la base (recibo_venta);
// acá solo se les da formato y se escribe el texto de WhatsApp con lo que la base entregó.
import { MEDIO } from "@/lib/caja";
import { formatearPesos } from "@/lib/formato";
import { linkWhatsappSocio } from "@/lib/whatsapp";

export type ReciboDatos = {
  venta_id: string; numero: number; numero_texto: string; anulado: boolean; fecha: string;
  gimnasio: { nombre: string; logo_path: string | null };
  sede: { nombre: string; direccion: string | null; telefono: string | null };
  socio: { nombre: string; dni: string | null } | null;
  items: { descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }[];
  total: number;
  pagos: { medio: string; monto: number }[];
  cobro: string | null;
  telefono: string | null;
  anulacion: { fecha: string; motivo: string | null } | null;
};

export const medioTexto = (m: string) => MEDIO[m] ?? m;

/** El recibo en texto plano, para mandarlo por WhatsApp o copiarlo. */
export function textoRecibo(r: ReciboDatos): string {
  const lineas = [
    `🧾 Recibo N° ${r.numero_texto}${r.anulado ? " (ANULADO)" : ""}`,
    `${r.gimnasio.nombre}${r.sede.direccion ? ` · ${r.sede.direccion}` : ""}`,
    r.fecha,
    ...(r.socio ? [`Socio: ${r.socio.nombre}`] : []),
    "",
    ...r.items.map((i) => `${i.cantidad} × ${i.descripcion}: ${formatearPesos(i.subtotal)}${Number(i.descuento) > 0 ? ` (con ${formatearPesos(i.descuento)} de descuento)` : ""}`),
    `Total: ${formatearPesos(r.total)}`,
    ...(r.pagos.length ? [`Pagado con ${r.pagos.map((p) => `${medioTexto(p.medio)} ${formatearPesos(p.monto)}`).join(" + ")}`] : []),
    ...(r.cobro ? [`Cobró: ${r.cobro}`] : []),
    ...(r.anulado ? ["", `Este recibo está ANULADO${r.anulacion ? ` desde el ${r.anulacion.fecha}` : ""}.`] : []),
  ];
  return lineas.join("\n");
}

/** Equipo: al celular del socio (si tiene). Socio: abre WhatsApp para elegir a quién mandárselo. */
export function linkWhatsappRecibo(r: ReciboDatos): string {
  const texto = textoRecibo(r);
  return linkWhatsappSocio(r.telefono, texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
