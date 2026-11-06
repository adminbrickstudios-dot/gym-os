// VD-9 · Tipos de la caja por turno (lo que devuelven las funciones de la base).
export type EstadoTurno = "abierto" | "sin_contar" | "sin_contar_dejada" | "contada_despues" | "cerrado";

export type ConfigCaja = { modo: "por_turno" | "una_por_dia"; pedir_billetes: boolean; fondo_fijo: number; hora_corte: string; horas_max: number };

export type Billetes = Record<string, number>;

export type ParaRevisar = {
  turno_id: string; caja: string; abierto_en: string; cerrado_en: string; abierto_por: string | null; esperado: number;
  monto_inicial: number; efectivo: number; ingresos: number; retiros: number; estado: EstadoTurno;
};

export type PorMedio = { medio: string; total: number; cantidad: number };

export type ReporteTurno = {
  turno_id: string; caja: string; estado: EstadoTurno; abierto_en: string; cerrado_en: string | null; abierto_por: string | null; cerrado_por: string | null;
  monto_inicial: number; efectivo: number; ingresos: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  otros_medios: Record<string, number>; nota: string | null; billetes: Billetes | null; revisado_nota: string | null; revisado_por: string | null; contado_en: string | null;
  por_medio: PorMedio[]; ventas: { cantidad: number; total: number }; anuladas: { cantidad: number; total: number };
  movimientos: { tipo: "ingreso" | "retiro"; monto: number; motivo: string; en: string; por: string | null }[]; dejados_pasar: number;
};

export type ReporteDia = {
  dia: string; desde: string; hasta: string; turnos: (Omit<ReporteTurno, "por_medio" | "ventas" | "anuladas" | "movimientos" | "dejados_pasar"> & { caja: string })[];
  esperado_contado: number; contado: number; diferencia: number; sin_contar: number; esperado_sin_contar: number; abiertos: number;
  por_medio: PorMedio[]; ventas: { cantidad: number; total: number }; anuladas: number; retiros: number; dejados_pasar: number;
};

export type MiTurno = {
  turno: { turno_id: string; caja: string; abierto_en: string; vencido: boolean } | null;
  libres: { caja_id: string; nombre: string; fondo_sugerido: number; con_vencida: boolean }[];
  modo: ConfigCaja["modo"]; pedir_billetes: boolean;
};
