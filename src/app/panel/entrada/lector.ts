// C5 · Lector de QR o de tarjeta por USB: se comporta como un teclado que tipea el código de corrido y cierra con Enter.
// Se distingue de una persona por la velocidad: una persona no pasa de una tecla cada 80 ms, un lector manda una cada 1 a 10 ms.
// Esto solo dice SI lo que entró fue una lectura. Quién es el socio y si entra lo contesta la base (estado_acceso): acá no se calcula nada.

/** Entre dos teclas de un mismo código hay menos que esto. */
export const LECTOR_PAUSA_MAX_MS = 50;
/** Un código de corrido de menos teclas que esto no se toma como lectura (DNI de 6 dígitos para arriba sí). */
export const LECTOR_MIN_CARACTERES = 6;
/** El mismo código leído dos veces dentro de esta ventana es el mismo toque (doble Enter del lector): se ignora el segundo. */
export const LECTOR_REPETIDA_MS = 2000;

export type DetectorLector = {
  /** Cada tecla que se aprieta en el campo (solo cuentan las que escriben un carácter). */
  tecla: (key: string, timeStamp: number) => void;
  /** En el Enter: dice si lo que se tipeó antes fue una lectura, y vuelve a empezar. */
  enter: (timeStamp: number) => boolean;
  reiniciar: () => void;
};

export function crearDetectorLector(pausaMax = LECTOR_PAUSA_MAX_MS, minimo = LECTOR_MIN_CARACTERES): DetectorLector {
  let racha = 0;
  let ultima: number | null = null;
  return {
    tecla(key, ts) {
      if (key.length !== 1) return;   // Shift, Tab, flechas: no escriben nada
      racha = ultima !== null && ts - ultima < pausaMax ? racha + 1 : 1;
      ultima = ts;
    },
    enter(ts) {
      const fue = ultima !== null && racha >= minimo && ts - ultima < pausaMax * 2;
      racha = 0; ultima = null;
      return fue;
    },
    reiniciar() { racha = 0; ultima = null; },
  };
}

/** ¿Es el mismo código que se acaba de resolver, hace menos de LECTOR_REPETIDA_MS? */
export function esLecturaRepetida(anterior: { codigo: string; en: number } | null, codigo: string, ahora: number): boolean {
  return !!anterior && anterior.codigo === codigo && ahora - anterior.en < LECTOR_REPETIDA_MS;
}
