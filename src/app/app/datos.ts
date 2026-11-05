import "server-only";
import type { Veredicto } from "@/app/panel/entrada/acciones";

export type MiSocio = {
  elegir: boolean;
  socios: { socio_id: string; nombre: string }[];
  socio?: { socio_id: string; nombre: string; apellido: string; numero: number };
  acceso?: Veredicto;
  plan?: { nombre: string; precio_transferencia: number | null } | null;
  packs?: { plan: string; cantidad: number; usadas: number; vence_en: string | null }[];
  reservas?: { reserva_id: string; clase_id: string; actividad: string; emoji: string | null; inicio: string; estado: string; posicion: number | null }[];
  transferencia?: { alias: string | null; cbu: string | null; titular: string | null; banco?: string | null } | null;
  pendiente?: { monto: number; informado_en: string } | null;
  modo_clases?: string;
  zona?: string;
  sedes?: { sede_id: string; nombre: string }[];
};
