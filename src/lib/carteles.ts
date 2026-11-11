// C4 · Lo que dicen los carteles. Salen de cómo entra la gente en cada gimnasio (configuracion_gimnasio.accesos_activos, que lee
// formas_de_entrada): el cartel solo promete lo que ese gimnasio tiene prendido. Funciones puras: se prueban sin pantalla.

export type TextoCartel = { titulo: string; pasos: string[]; pie: string; aviso?: string };

/**
 * El cartel de la puerta. El QR de la tablet cambia cada 30 segundos (lo firma la base), así que NO se puede imprimir: el cartel
 * le dice al socio que lo escanee en la tablet. Con el QR de la tablet apagado, el cartel dice cómo entrar con lo que haya.
 */
export function cartelPuerta(formas: string[], gimnasio: string): TextoCartel {
  const tiene = (f: string) => formas.includes(f);
  const tablet = tiene("kiosco");
  const sinCelular = tablet ? "¿Sin celular? Escribí tu DNI en la tablet o decíselo a recepción." : "¿Sin celular? Decí tu DNI en recepción.";
  if (tablet && tiene("qr_pared")) {
    return {
      titulo: "Escaneá el QR de la tablet para entrar",
      pasos: [`Abrí la app de ${gimnasio}.`, "Tocá “Escanear el QR de la entrada”.", "Apuntá la cámara al QR de la tablet."],
      pie: sinCelular,
      aviso: "El QR de la tablet cambia cada 30 segundos: por eso el cartel no lleva un QR impreso. Pegalo cerca de la tablet.",
    };
  }
  if (tiene("qr_socio")) {
    return {
      titulo: "Entrá con el QR de tu app",
      pasos: [`Abrí la app de ${gimnasio}.`, "En Inicio vas a ver tu QR.", "Mostralo en la entrada."],
      pie: sinCelular,
    };
  }
  return {
    titulo: "Para entrar, decí tu DNI",
    pasos: [],
    pie: tablet ? "Escribí tu DNI en la tablet o decíselo a recepción." : "Decíselo a quien está en recepción.",
    aviso: "Tu gimnasio no tiene prendido el QR del socio ni el QR de la tablet (Configuración, Reglas, Cómo entra la gente). El cartel dice solo cómo entrar con el DNI.",
  };
}

/** El cartel "Descargá la app": los pasos son los mismos en todos los gimnasios (la app es la misma y se instala igual). */
export const PASOS_DESCARGAR_APP = [
  "Escaneá el QR con la cámara del celular.",
  "Tocá “Soy socio” y entrá.",
  "Tocá “Instalar”. En iPhone: Compartir y “Agregar a inicio”.",
];
