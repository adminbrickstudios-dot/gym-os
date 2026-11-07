// VD-46M · Los datos del modo emergencia (los arma la base).
export type EmergenciaActiva = { id: string; sede_id: string; motivo: string; desde: string; vence_en: string; por: string | null; entradas: number };
export type EstadoEmergencia = { habilitada: boolean; puede_activar: boolean; puede_habilitar: boolean; activa: EmergenciaActiva | null };
export type EntradaEmergencia = { ingreso_id: string; momento: string; socio_id: string; socio: string; via: string; color: string; motivo: string; texto: string; no_al_dia: boolean };
export type EmergenciaHistorial = {
  id: string; sede: string; sede_id: string; motivo: string; desde: string; hasta: string; estado: "activa" | "cerrada" | "vencida";
  por: string | null; cerro: string | null; entradas: number; no_al_dia: number;
};
