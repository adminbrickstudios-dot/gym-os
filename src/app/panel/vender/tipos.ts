export type Precios = { lista: number | null; efectivo: number | null; transferencia: number | null; debito: number | null; credito: number | null };
export type Medio = "efectivo" | "transferencia" | "debito" | "credito";
export type PreciosVenta = {
  tope_descuento: number | null;
  /** Medios que acepta el gimnasio para cobrar acá (sin Caja, sin efectivo). */
  medios: Medio[];
  cuota: { plan_id: string; plan: string; duracion_meses: number; precios: Precios } | null;
  /** La matrícula de su plan, si la debe (PLA-3). Se calcula en la base de lo cobrado. */
  matricula?: { plan_id: string; plan: string; monto: number; anual: boolean } | null;
  /** Recargo por pagar tarde, si corresponde hoy (PLA-7). Va siempre con la cuota. */
  recargo?: { monto: number; atraso: number; dias: number } | null;
  pases: { plan_id: string; nombre: string; precios: Precios }[];
  packs: { plan_id: string; nombre: string; cantidad_clases: number; precios: Precios }[];
  productos: { producto_id: string; nombre: string; precio: number }[];
};
export type Linea = {
  clave: string;
  tipo: "cuota" | "pase" | "pack" | "producto" | "matricula" | "recargo" | "otro";
  nombre: string;
  plan_id?: string;
  producto_id?: string;
  cantidad: number;
  precios?: Precios;       // planes: el precio depende del medio
  precio_fijo?: number;    // productos y "otro"
  descuento?: number;
  descuento_texto?: string;  // lo que se escribió ("1.500"), para no perder el punto mientras se tipea
  descuento_motivo?: string;
};

/** Precio unitario de una línea con el medio elegido. Con pago mixto (medio null) rige el de lista, como en la base. */
export function precioUnitario(l: Linea, medio: Medio | null): number | null {
  if (l.precio_fijo != null) return l.precio_fijo;
  if (!l.precios) return null;
  return (medio ? l.precios[medio] : null) ?? l.precios.lista;
}

export function totalCarrito(lineas: Linea[], medio: Medio | null): number | null {
  let t = 0;
  for (const l of lineas) {
    const p = precioUnitario(l, medio);
    if (p == null) return null;
    t += Math.round((p * l.cantidad - (l.descuento ?? 0)) * 100) / 100;
  }
  return Math.round(t * 100) / 100;
}

/** La línea del recargo por pagar tarde (PLA-7): la base la exige junto con la cuota. */
export function lineaRecargo(r: NonNullable<PreciosVenta["recargo"]>): Linea {
  return { clave: "recargo", tipo: "recargo", nombre: `Recargo por pagar tarde (${r.atraso} días)`, precio_fijo: Number(r.monto), cantidad: 1 };
}
