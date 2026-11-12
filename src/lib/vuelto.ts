/**
 * Vuelto en efectivo: solo para mostrar en pantalla (la plata cobrada es el total, no lo que entrega el socio).
 * Los billetes de curso legal que se ofrecen como botones rápidos: el primero que alcanza y los dos siguientes.
 */
const BILLETES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

export function billetesRapidos(total: number): number[] {
  if (!(total > 0)) return [];
  const mayores = BILLETES.filter((b) => b >= total);
  // Si el total supera el billete más grande, se ofrece el múltiplo redondo que sigue.
  if (mayores.length === 0) return [Math.ceil(total / 100000) * 100000];
  return mayores.slice(0, 3).filter((b) => b !== total);
}

/** Lo que sobra (vuelto) o lo que falta de lo que entregó el socio. Redondea a centavos para que 0,1 + 0,2 no ensucie. */
export function calcularVuelto(total: number, paga: number): { vuelto: number; falta: number } {
  const dif = Math.round((paga - total) * 100) / 100;
  return dif >= 0 ? { vuelto: dif, falta: 0 } : { vuelto: 0, falta: -dif };
}
