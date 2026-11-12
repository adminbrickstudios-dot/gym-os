"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filtrarComandos, type Comando } from "@/lib/admin/paleta";
import { Icono } from "@/components/ui/Icono";

export type GimnasioPaleta = { id: string; nombre: string; slug: string };

/** Ctrl+K en /admin: gimnasios, personas y acciones ("crear gimnasio", "entrar a olympo"). */
export function Paleta({ gimnasios }: { gimnasios: GimnasioPaleta[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const comandos = useMemo<Comando[]>(() => [
    { texto: "Crear gimnasio", destino: "/admin#alta", clave: "crear alta nuevo gimnasio" },
    { texto: "Buscar a una persona", destino: "/admin/buscar", clave: "buscar persona socio mail dni celular" },
    { texto: "Lista de gimnasios", destino: "/admin/gimnasios", clave: "lista gimnasios filtros" },
    { texto: "Tablero", destino: "/admin", clave: "inicio tablero atencion" },
    { texto: "Seguridad y usuarios de BRIK", destino: "/admin/seguridad", clave: "seguridad dos pasos roles usuarios" },
    { texto: "Registro de BRIK", destino: "/admin/registro", clave: "registro auditoria" },
    { texto: "Plantillas de textos", destino: "/admin/plantillas", clave: "plantillas textos web mensajes tipo" },
    ...gimnasios.flatMap((g) => [
      { texto: `Abrir la ficha de ${g.nombre}`, destino: `/admin/${g.id}`, clave: `${g.nombre} ${g.slug} ficha` },
      { texto: `Entrar a ${g.nombre} como soporte`, destino: `/admin/${g.id}#entrar`, clave: `entrar soporte ${g.nombre} ${g.slug}` },
    ]),
  ], [gimnasios]);
  const lista = useMemo(() => filtrarComandos(comandos, q).slice(0, 8), [comandos, q]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAbierta((a) => !a); setQ(""); setSel(0); }
      else if (e.key === "Escape") setAbierta(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => { if (abierta) entrada.current?.focus(); }, [abierta]);
  if (!abierta) return (
    <button type="button" onClick={() => { setAbierta(true); setQ(""); setSel(0); }} data-abrir-paleta aria-label="Buscar o ir a (Ctrl K)" title="Buscar (Ctrl K)"
      className="fixed z-40 right-4 bottom-4 size-12 rounded-full bg-[var(--acento)] text-[var(--sobre-acento)] grid place-items-center text-xl active:scale-95 transition-transform" style={{ boxShadow: "var(--sombra-flota)" }}><Icono nombre="buscar" /></button>
  );
  const ir = (c: Comando | undefined) => { if (!c) return; setAbierta(false); router.push(c.destino); };
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 p-4 pt-[15vh]" role="dialog" aria-modal="true" aria-label="Buscar o ir a" data-paleta onClick={() => setAbierta(false)}>
      <div className="tarjeta w-full max-w-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <input ref={entrada} className="campo" value={q} placeholder="Un gimnasio, una acción…" aria-label="Buscar"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, lista.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter") ir(lista[sel]);
          }} />
        <ul role="listbox" className="space-y-1">
          {lista.map((c, i) => (
            <li key={c.destino + c.texto} role="option" aria-selected={i === sel}>
              <button type="button" className={`boton w-full text-left ${i === sel ? "!border-[var(--acento)]" : ""}`} onClick={() => ir(c)}>{c.texto}</button>
            </li>
          ))}
          {lista.length === 0 && <li className="texto-suave px-2 py-1">Nada con eso. Para buscar a una persona, usá “Buscar a una persona”.</li>}
        </ul>
      </div>
    </div>
  );
}
