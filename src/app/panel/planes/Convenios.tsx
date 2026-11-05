"use client";
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { guardarConvenio, type Convenio } from "./acciones";

const valorTexto = (c: { tipo: string; valor: number }) => (c.tipo === "porcentaje" ? `${Number(c.valor)} %` : formatearPesos(c.valor));

function Formulario({ c, cerrar }: { c?: Convenio; cerrar: () => void }) {
  const [nombre, setNombre] = useState(c?.nombre ?? "");
  const [tipo, setTipo] = useState<"porcentaje" | "monto">(c?.tipo ?? "porcentaje");
  const [valor, setValor] = useState(c ? String(c.valor).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <form className="flex flex-wrap items-center gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await guardarConvenio(c?.convenio_id ?? null, nombre, tipo, valor, c?.activo ?? true); setError(r.error ?? null); if (!r.error) cerrar(); }); }}>
      <input autoFocus required className="campo !w-auto flex-1 min-w-40" placeholder="Nombre (ej: Estudiantes)" aria-label="Nombre del convenio" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <select className="campo !w-auto" aria-label="Tipo de descuento" value={tipo} onChange={(e) => setTipo(e.target.value as "porcentaje" | "monto")}>
        <option value="porcentaje">% de la cuota</option><option value="monto">$ fijo por cuota</option>
      </select>
      <input required className="campo !w-28" inputMode="decimal" placeholder={tipo === "porcentaje" ? "%" : "$"} aria-label="Cuánto descuenta" value={valor} onChange={(e) => setValor(e.target.value)} />
      <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
      <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
      {error && <p role="alert" className="pildora pildora-rojo w-full">⚠️ {error}</p>}
    </form>
  );
}

/** VEN-3: los convenios del gimnasio. Se asignan desde la ficha del socio; Vender los aplica solos a la cuota. */
export function Convenios({ convenios }: { convenios: Convenio[] }) {
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section data-convenios>
      <h2 className="titulo text-3xl mb-1">🤝 Convenios</h2>
      <p className="texto-suave mb-4">Descuentos fijos para un grupo (estudiantes, una empresa, familiares). Se asignan desde la ficha del socio y Vender los descuenta solos de la cuota.</p>
      {convenios.length === 0 && !nuevo && <p className="texto-tenue mb-3">Todavía no hay convenios.</p>}
      <ul className="grid sm:grid-cols-2 gap-2 mb-3">
        {convenios.map((c) => (
          <li key={c.convenio_id} className={`tarjeta px-4 py-3 ${c.activo ? "" : "opacity-55"}`} data-convenio={c.nombre}>
            {editando === c.convenio_id ? <Formulario c={c} cerrar={() => setEditando(null)} /> : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex-1 min-w-0 font-semibold">{c.nombre}</span>
                <span className="numero text-xl">−{valorTexto(c)}</span>
                <span className="texto-tenue text-sm w-full">{c.socios} {c.socios === 1 ? "socio" : "socios"}{c.activo ? "" : " · desactivado"}</span>
                <button type="button" className="boton-texto" onClick={() => setEditando(c.convenio_id)}>✏️ Editar</button>
                <button type="button" className="boton-texto" disabled={ocupado} onClick={() => empezar(async () => { await guardarConvenio(c.convenio_id, c.nombre, c.tipo, String(c.valor), !c.activo); })}>{c.activo ? "Desactivar" : "Activar"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {nuevo ? <Formulario cerrar={() => setNuevo(false)} /> : <button type="button" className="boton" onClick={() => setNuevo(true)}>➕ Nuevo convenio</button>}
    </section>
  );
}
