"use client";
// VD-46U · Configuración → Reglas: los topes de cortesías, la regla de devolución al dar de baja y la lista de motivos de
// cortesías y descuentos (antes solo en Control). Es el mismo componente que usa Control: lo que se cambia acá se ve allá.
import { TopesYMotivos, type MotivosBeneficio, type TopesBeneficios } from "@/app/panel/control/Beneficios";
import { Icono } from "@/components/ui/Icono";

export type ReglasBeneficiosDatos = { gimnasio_id: string; puede_editar: boolean; devolucion_modo: string; topes: TopesBeneficios; motivos: MotivosBeneficio };

export function ReglasBeneficios({ datos: d }: { datos: ReglasBeneficiosDatos }) {
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-reglas-beneficios>
      <p className="titulo text-2xl"><Icono nombre="regalo" /> Cortesías, descuentos y devoluciones</p>
      <p className="texto-suave">Cuánto puede regalar cada rol, por qué motivos se puede dar un descuento o una cortesía y qué se le devuelve a quien se da de baja con cuota adelantada.{d.puede_editar ? "" : " Lo cambia el dueño."}</p>
      <TopesYMotivos gimnasioId={d.gimnasio_id} topes={d.topes} motivos={d.motivos} puedeEditar={d.puede_editar} devolucionModo={d.devolucion_modo} />
    </section>
  );
}
