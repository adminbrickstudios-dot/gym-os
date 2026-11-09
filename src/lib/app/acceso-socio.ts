// F1.2 · El socio dado de alta con mail recibe un link para crear su contraseña (D43). Lo puro está acá (se prueba sin
// base); lo que toca la cuenta está en `acceso-socio-servidor.ts`.

/** El link para crear la contraseña: abre "Creá tu contraseña" con el mail ya puesto; al terminar, el socio cae en su app. */
export function linkCrearContrasena(origen: string, email: string): string {
  const base = origen.replace(/\/+$/, "");
  return `${base}/ingresar/recuperar?nueva=1&siguiente=${encodeURIComponent("/app")}&email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

/** El mensaje que se copia o se manda por WhatsApp (wa.me) junto con el link. */
export function textoLinkContrasena(datos: { gimnasio: string; nombre: string; link: string }): string {
  const nombre = datos.nombre.trim().split(/\s+/)[0] || "";
  return `${nombre ? `Hola ${nombre}! ` : "Hola! "}Ya sos socio de ${datos.gimnasio}. Creá tu contraseña acá para entrar a tu app: ${datos.link}`;
}
