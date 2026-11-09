// Ayudas puras del super admin (lista, links por rol, WhatsApp, CSV). Sin acceso a datos: se prueban solas.

export type FilaGimnasio = {
  gimnasio_id: string; slug: string; nombre: string; es_demo: boolean; alta: string; favorito: boolean; suspendido: boolean;
  socios_activos: number; entradas_hoy: number; ultimo_uso: string | null; abono: string; plan: string | null;
  color: "rojo" | "amarillo" | "verde"; motivos: string[]; dueno: string | null; dueno_telefono: string | null; hosts: string[];
};

export const ROLES_PUERTA = [["dueno", "Dueño", "/dueno"], ["recepcion", "Recepción", "/recepcion"], ["profe", "Profe", "/profe"], ["socio", "Socio", "/socio"]] as const;

/** El link de cada rol en la dirección del gimnasio (la primera dirección que tenga). */
export function enlacesPorRol(host: string | undefined): { rol: string; nombre: string; url: string }[] {
  if (!host) return [];
  const base = /^https?:\/\//.test(host) ? host : `https://${host}`;
  return ROLES_PUERTA.map(([rol, nombre, ruta]) => ({ rol, nombre, url: `${base.replace(/\/$/, "")}${ruta}` }));
}

/** wa.me al celular del dueño con un mensaje armado. Sin celular válido devuelve null. */
export function whatsappDueno(telefono: string | null | undefined, mensaje: string): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensaje)}`;
}

const NOMBRE_ABONO: Record<string, string> = { al_dia: "Al día", por_vencer: "Por vencer", vencido: "Vencido", sin_abono: "Sin abono" };
export const nombreAbono = (a: string) => NOMBRE_ABONO[a] ?? a;

/** "hace 3 días": la fecha exacta va en el title. */
export function haceCuanto(iso: string | null, ahora = Date.now()): string {
  if (!iso) return "nunca";
  const d = Math.floor((ahora - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
}

const celda = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // que Excel no lo tome como fórmula
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Exportar la lista (SA-2): CSV con BOM para que Excel respete los acentos. */
export function csvGimnasios(filas: FilaGimnasio[]): string {
  const cab = ["Gimnasio", "Slug", "Socios activos", "Entradas hoy", "Último uso del panel", "Abono", "Plan", "Salud", "Motivos", "Dueño", "Celular del dueño", "Direcciones", "Alta"];
  const lineas = filas.map((f) => [f.nombre, f.slug, f.socios_activos, f.entradas_hoy, f.ultimo_uso ?? "", nombreAbono(f.abono), f.plan ?? "", f.color,
    f.motivos.join(" | "), f.dueno ?? "", f.dueno_telefono ?? "", f.hosts.join(" "), f.alta].map(celda).join(","));
  return "﻿" + [cab.map(celda).join(","), ...lineas].join("\r\n") + "\r\n";
}
