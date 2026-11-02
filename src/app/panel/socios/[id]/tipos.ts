import type { Veredicto } from "@/app/panel/entrada/acciones";

export type Ficha = {
  socio: {
    id: string; numero: number; nombre: string; apellido: string; dni: string | null; telefono: string | null; email: string | null;
    fecha_nacimiento: string | null; contacto_emergencia_nombre: string | null; contacto_emergencia_telefono: string | null;
    notas: string | null; dado_de_baja_en: string | null; motivo_baja: string | null; creado_en: string; tiene_app: boolean;
  };
  acceso: Veredicto;
  membresia: { suscripcion_id: string; plan_id: string; plan: string; tipo: string; inicio: string; precio: number | null } | null;
  ingresos: { id: string; momento: string; resultado: string; color: string; texto: string; via_acceso: string }[];
  pagos: { id: string; fecha: string; monto: number; medio: string; estado: string; detalle: string | null }[] | null;
  packs: { id: string; plan: string; cantidad: number; usadas: number; vence_en: string | null }[];
};
