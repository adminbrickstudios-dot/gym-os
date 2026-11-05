"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { guardarSocio, type EstadoForm } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";

export type PlanAlta = { plan_id: string; nombre: string; precio: number | null };

type Socio = Partial<Record<"nombre" | "apellido" | "dni" | "telefono" | "email" | "fecha_nacimiento" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono" | "notas" | "responsable_nombre" | "responsable_telefono", string | null>>;

function Campo({ nombre, etiqueta, valor, tipo = "text", ayuda, ...resto }: { nombre: string; etiqueta: string; valor?: string | null; tipo?: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2">
      <span className="etiqueta">{etiqueta}</span>
      <input name={nombre} type={tipo} defaultValue={valor ?? ""} className="campo" {...resto} />
      {ayuda && <span className="block text-sm texto-tenue">{ayuda}</span>}
    </label>
  );
}

function esMenor(nacimiento: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return false;
  const hoy = new Date(), [a, m, d] = nacimiento.split("-").map(Number);
  const cumple18 = new Date(a + 18, m - 1, d);
  return cumple18 > hoy;
}

export function FormSocio({ socioId, socio, prospectoId, planes = [], puedeCobrar = false }: {
  socioId: string | null; socio?: Socio; prospectoId?: string; planes?: PlanAlta[]; puedeCobrar?: boolean;
}) {
  const [plan, setPlan] = useState("");
  const router = useRouter();
  const [estado, accion, guardando] = useActionState<EstadoForm, FormData>(guardarSocio.bind(null, socioId), {});
  useEffect(() => { if (estado.destino) router.push(estado.destino); }, [estado.destino, router]);
  // Menor de 18 (D10): aparece el adulto responsable. La base lo exige igual.
  const [nacimiento, setNacimiento] = useState(socio?.fecha_nacimiento ?? "");
  const menor = esMenor(nacimiento);
  return (
    <form action={accion} className="max-w-2xl space-y-8">
      {prospectoId && <input type="hidden" name="prospecto" value={prospectoId} />}
      {prospectoId && <Mensaje tipo="info">Viene de Prospectos: al darlo de alta queda marcado como “se hizo socio”.</Mensaje>}
      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="titulo text-2xl mb-4">👤 Datos</legend>
        <Campo nombre="nombre" etiqueta="Nombre" valor={socio?.nombre} required autoFocus autoComplete="off" />
        <Campo nombre="apellido" etiqueta="Apellido" valor={socio?.apellido} autoComplete="off" />
        <Campo nombre="dni" etiqueta="DNI" valor={socio?.dni} inputMode="numeric" ayuda="Solo números, sin puntos" />
        <Campo nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" valor={socio?.fecha_nacimiento} tipo="date" onChange={(e) => setNacimiento(e.target.value)} />
      </fieldset>
      {(menor || socio?.responsable_nombre) && (
        <fieldset className="grid sm:grid-cols-2 gap-4" data-responsable>
          <legend className="titulo text-2xl mb-1">👨‍👧 Adulto responsable</legend>
          <p className="sm:col-span-2 texto-suave -mt-1 mb-2">{menor ? "Es menor de 18: se carga con un adulto responsable. Es quien entra a la app y a quien se le avisa." : "Ya es mayor de edad: podés dejarlo o borrarlo."}</p>
          <Campo nombre="responsable_nombre" etiqueta="Nombre del responsable" valor={socio?.responsable_nombre} required={menor} autoComplete="off" />
          <Campo nombre="responsable_telefono" etiqueta="Celular del responsable" valor={socio?.responsable_telefono} tipo="tel" required={menor} placeholder="387 555-1234" />
        </fieldset>
      )}
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
      {!socioId && planes.length > 0 && (
        <fieldset className="space-y-2" data-plan-alta>
          <legend className="titulo text-2xl mb-2">🏷️ Plan</legend>
          <select name="plan_id" value={plan} onChange={(e) => setPlan(e.target.value)} className="campo" aria-label="Plan">
            <option value="">Sin plan por ahora (viene con pase o pack)</option>
            {planes.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.nombre}{p.precio != null ? ` · ${formatearPesos(p.precio)}` : ""}</option>)}
          </select>
        </fieldset>
      )}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        {!socioId && plan && puedeCobrar
          ? <>
              <button type="submit" name="despues" value="cobrar" disabled={guardando || !!estado.destino} className="boton boton-principal text-lg px-8">{guardando ? "Guardando…" : "✅ Dar de alta y cobrar"}</button>
              <button type="submit" disabled={guardando || !!estado.destino} className="boton">Solo dar de alta</button>
            </>
          : <button type="submit" disabled={guardando || !!estado.destino} className="boton boton-principal text-lg px-8">{guardando ? "Guardando…" : socioId ? "✅ Guardar cambios" : "✅ Dar de alta"}</button>}
        <button type="button" onClick={() => router.back()} className="boton">Cancelar</button>
      </div>
    </form>
  );
}
