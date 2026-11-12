// VD-38 (D27): los mensajes de los socios al gimnasio. Textos y tipos compartidos por la app del socio y el panel.
export const MOTIVOS = [
  { clave: "consulta", emoji: "ayuda", titulo: "Consulta", ayuda: "Una duda sobre horarios, planes, clases…" },
  { clave: "queja", emoji: "alerta", titulo: "Queja", ayuda: "Algo que no estuvo bien y querés que sepamos." },
  { clave: "objeto_perdido", emoji: "caja", titulo: "Objeto perdido", ayuda: "Perdiste algo en el gimnasio. Podés sumar una foto." },
  { clave: "otro", emoji: "mensaje", titulo: "Otro", ayuda: "Cualquier otra cosa." },
] as const;
export type Motivo = (typeof MOTIVOS)[number]["clave"];
export const motivoDe = (clave: string) => MOTIVOS.find((m) => m.clave === clave) ?? MOTIVOS[3];

export type EstadoHilo = "nuevo" | "en_curso" | "resuelto";
export const ESTADOS: { clave: EstadoHilo; titulo: string; color: "rojo" | "amarillo" | "verde" }[] = [
  { clave: "nuevo", titulo: "Nuevo", color: "rojo" },
  { clave: "en_curso", titulo: "En curso", color: "amarillo" },
  { clave: "resuelto", titulo: "Resuelto", color: "verde" },
];
export const estadoDe = (clave: string) => ESTADOS.find((e) => e.clave === clave) ?? ESTADOS[0];

/** Lo que se le recuerda a quien escribe: el sistema no guarda datos de salud. */
export const AVISO_SALUD = "Por favor no cuentes diagnósticos ni datos médicos: si tenés una lesión o una condición, avisale en persona a tu profe.";

export const MAX_TEXTO = 2000;
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FOTO = 2.5 * 1024 * 1024;   // la acción del servidor admite 3 MB en total: el celular achica antes de mandar

export type MensajeHilo = { id: string; autor: "socio" | "equipo"; texto: string; con_foto: boolean; creado_en: string; quien?: string | null; foto_url?: string | null };
export type FilaSocio = { hilo_id: string; motivo: string; estado: string; creado_en: string; ultimo_en: string; ultimo_autor: string; sin_leer: boolean; extracto: string | null };
export type HiloSocio = { hilo_id: string; socio_id: string; motivo: string; estado: string; creado_en: string; mensajes: MensajeHilo[] };
export type FilaBandeja = {
  hilo_id: string; socio_id: string; socio: string; motivo: string; estado: string; creado_en: string; ultimo_en: string;
  ultimo_autor: string; sin_responder: boolean; con_foto: boolean; extracto: string | null;
};
export type Bandeja = { items: FilaBandeja[]; conteos: { nuevo: number; en_curso: number; resuelto: number; sin_responder: number } };
export type HiloPanel = HiloSocio & { socio: string; resuelto_en: string | null };
export type RespuestaRapida = { id: string; titulo: string; texto: string };
export type FilaHistorial = { hilo_id: string; motivo: string; estado: string; creado_en: string; ultimo_en: string; sin_responder: boolean; extracto: string | null };

/** El archivo de la foto es una imagen que entra (tipo y tamaño). */
export function fotoValida(f: { type: string; size: number }): string | null {
  if (!TIPOS_FOTO.includes(f.type)) return "La foto tiene que ser JPG, PNG o WEBP.";
  if (f.size > MAX_FOTO) return "La foto es muy pesada: hasta 2,5 MB.";
  return null;
}
