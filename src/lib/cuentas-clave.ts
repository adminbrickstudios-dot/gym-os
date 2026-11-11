// C1 · Nueva clave sin mails. Lo puro (se prueba sin base): el mensaje que se copia o se manda por WhatsApp.
// La clave nunca se guarda: se arma el texto en el momento y se muestra una sola vez.

export type DestinoClave = "socio" | "equipo";

/** Resultado de pedir una clave nueva (lo que ve la pantalla). */
export type ResultadoClave = {
  error?: string;
  aviso?: string;
  contrasena?: string;
  email?: string;
  /** El mensaje armado, listo para copiar o mandar. */
  texto?: string;
  /** Se creó la cuenta en este momento (el socio todavía no tenía). */
  creada?: boolean;
};

/** A dónde entra: el socio por su pestaña, el equipo por la general. Siempre en el dominio del propio gimnasio. */
export function linkIngreso(origen: string, destino: DestinoClave): string {
  const base = origen.replace(/\/+$/, "");
  return destino === "socio" ? `${base}/ingresar?modo=socio` : `${base}/ingresar`;
}

export function textoClave(d: { gimnasio: string; nombre: string; destino: DestinoClave; origen: string; email: string; contrasena: string }): string {
  const nombre = d.nombre.trim().split(/\s+/)[0] || "";
  const saludo = nombre ? `Hola ${nombre}! ` : "Hola! ";
  const donde = d.destino === "socio" ? "la app de" : "al panel de";
  const despues = d.destino === "socio" ? "" : " Después cambiala en “Mi cuenta”.";
  return `${saludo}Tu acceso ${d.destino === "socio" ? "a " : ""}${donde} ${d.gimnasio}: entrá en ${linkIngreso(d.origen, d.destino)} con el mail ${d.email} y la clave ${d.contrasena}.${despues}`;
}

/** wa.me al número del socio si lo hay; si no, WhatsApp deja elegir a quién mandarlo. */
export function linkWhatsApp(texto: string, telefono?: string | null): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return `https://wa.me/${digitos.length >= 8 ? digitos : ""}?text=${encodeURIComponent(texto)}`;
}
