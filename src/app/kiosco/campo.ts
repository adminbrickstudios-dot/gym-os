// Lo que el campo del kiosco acepta mientras se tipea. Un DNI es solo números; un QR leído por un lector USB empieza con "GYMOS1."
// y llega tecla por tecla, así que las primeras letras ("G", "GY"...) tienen que sobrevivir hasta completar el prefijo.
export const PREFIJO_QR = "GYMOS1.";

export function valorDelCampo(valor: string, elegido: boolean, largo: number): string {
  if (!elegido) {
    const v = valor.trimStart();
    const mayus = v.toUpperCase();
    if (v.length > 0 && (PREFIJO_QR.startsWith(mayus) || mayus.startsWith(PREFIJO_QR))) return v.slice(0, 300);
  }
  return valor.replace(/\D/g, "").slice(0, largo);
}

export const SIN_CONEXION = "Sin conexión: pasá por recepción.";
