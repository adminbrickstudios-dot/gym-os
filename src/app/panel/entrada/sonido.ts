// El sonido de la puerta: lo usan la pantalla de Entrada y la ventana flotante.

/** Un sonido por color, para no tener que mirar: agudo y corto si entra, grave y doble si no. */
export function sonar(color: string) {
  try {
    const c = new AudioContext();
    const tonos: [number, number][] = color === "verde" ? [[880, 0.12]] : color === "rojo" || color === "gris" ? [[220, 0.18], [180, 0.28]] : [[560, 0.16], [560, 0.16]];
    let t = c.currentTime;
    for (const [f, d] of tonos) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = color === "verde" ? "sine" : "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d); t += d + 0.06;
    }
    setTimeout(() => void c.close(), 1500);
  } catch { /* sin audio: no pasa nada */ }
}
export const CLAVE_SONIDO = "gymos.entrada.sonido";
