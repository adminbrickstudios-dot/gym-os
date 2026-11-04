"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { guardarSocio, type EstadoForm } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

type Socio = Partial<Record<"nombre" | "apellido" | "dni" | "telefono" | "email" | "fecha_nacimiento" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono" | "notas", string | null>>;

function Campo({ nombre, etiqueta, valor, tipo = "text", ayuda, ...resto }: { nombre: string; etiqueta: string; valor?: string | null; tipo?: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2">
      <span className="etiqueta">{etiqueta}</span>
      <input name={nombre} type={tipo} defaultValue={valor ?? ""} className="campo" {...resto} />
      {ayuda && <span className="block text-sm texto-tenue">{ayuda}</span>}
    </label>
  );
}

export function FormSocio({ socioId, socio }: { socioId: string | null; socio?: Socio }) {
  const router = useRouter();
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(guardarSocio.bind(null, socioId), {});
  useEffect(() => { if (estado.destino) router.push(estado.destino); }, [estado.destino, router]);
  return (
    <form action={accion} className="max-w-2xl space-y-8">
      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="titulo text-2xl mb-4">👤 Datos</legend>
        <Campo nombre="nombre" etiqueta="Nombre" valor={socio?.nombre} required autoFocus autoComplete="off" />
        <Campo nombre="apellido" etiqueta="Apellido" valor={socio?.apellido} autoComplete="off" />
        <Campo nombre="dni" etiqueta="DNI" valor={socio?.dni} inputMode="numeric" ayuda="Solo números, sin puntos" />
        <Campo nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" valor={socio?.fecha_nacimiento} tipo="date" />
      </fieldset>
      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="titulo text-2xl mb-4">📱 Contacto</legend>
        <Campo nombre="telefono" etiqueta="WhatsApp" valor={socio?.telefono} tipo="tel" placeholder="387 555-1234" ayuda="Para avisarle cuándo vence" />
        <Campo nombre="email" etiqueta="Mail" valor={socio?.email} tipo="email" />
        <Campo nombre="contacto_emergencia_nombre" etiqueta="Contacto de emergencia" valor={socio?.contacto_emergencia_nombre} placeholder="Nombre" />
        <Campo nombre="contacto_emergencia_telefono" etiqueta="Teléfono de emergencia" valor={socio?.contacto_emergencia_telefono} tipo="tel" />
      </fieldset>
      <label className="block space-y-2">
        <span className="etiqueta">Notas</span>
        <textarea name="notas" defaultValue={socio?.notas ?? ""} className="campo" placeholder="Horario que prefiere, objetivo…" />
        <span className="block text-sm texto-tenue">🩺 No anotes datos de salud (lesiones, enfermedades): el sistema no los guarda.</span>
      </label>
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <div className="flex gap-2">
        <button type="submit" disabled={guardando || !!estado.destino} className="boton boton-principal text-lg px-8">{guardando ? "Guardando…" : socioId ? "✅ Guardar cambios" : "✅ Dar de alta"}</button>
        <button type="button" onClick={() => router.back()} className="boton">Cancelar</button>
      </div>
    </form>
  );
}
