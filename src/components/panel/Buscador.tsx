"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import type { Seccion } from "@/lib/panel/secciones";
import { Hoja } from "@/components/ui/Hoja";
import { PuntoEstado } from "./Estado";
import { abrirCobrar } from "./cobrar/evento";

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Ctrl+K: ir a una sección o abrir la ficha de un socio. */
export function Buscador({ secciones, buscaSocios, compacto = false, soloVer = false, puedeCobrar = false }: { secciones: Seccion[]; buscaSocios: boolean; compacto?: boolean; soloVer?: boolean; puedeCobrar?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buscando, empezar] = useTransition();
  const [marcado, setMarcado] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAbierto(true); }
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => { if (abierto) { setTimeout(() => campo.current?.focus(), 0); } else { setTexto(""); setSocios([]); setError(null); } }, [abierto]);

  // VD-5: "cobrar juan" busca a Juan y Enter abre Cobrar en vez de la ficha.
  const quiereCobrar = puedeCobrar && !soloVer && /^cobrar\s/i.test(texto);
  const consulta = (quiereCobrar ? texto.replace(/^cobrar\s+/i, "") : texto).trim();
  useEffect(() => {
    if (!buscaSocios || consulta.length < 2) { setSocios([]); setError(null); return; }
    const t = setTimeout(() => empezar(async () => {
      const r = await buscarSociosRapido(consulta);
      setSocios(r.socios ?? []);
      setError(r.error ?? null);
    }), 180);
    return () => clearTimeout(t);
  }, [consulta, buscaSocios]);

  const q = sinAcentos(consulta);
  const secc = q ? secciones.filter((s) => sinAcentos(`${s.titulo} ${s.descripcion}`).includes(q)) : secciones;
  const opciones: { ruta: string; clave: string }[] = [
    ...(soloVer ? [] : socios.map((s) => ({ ruta: `/panel/socios/${s.socio_id}`, clave: s.socio_id }))),
    ...secc.map((s) => ({ ruta: s.ruta, clave: s.clave })),
  ];
  useEffect(() => setMarcado(0), [texto, socios.length]);

  const ir = (ruta: string) => { setAbierto(false); router.push(ruta); };
  const cobrarA = (socioId: string) => { setAbierto(false); abrirCobrar({ socioId, origen: "buscador" }); };

  return (
    <>
      {compacto ? (
        <button type="button" onClick={() => setAbierto(true)} className="boton !min-h-11 !px-3" aria-label="Buscar">🔍</button>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className="boton w-full !justify-between texto-suave !font-medium">
          <span>🔍 Buscar…</span>
          <kbd className="text-xs texto-tenue font-sans">Ctrl K</kbd>
        </button>
      )}

      <Hoja abierta={abierto} alCerrar={() => setAbierto(false)} etiqueta="Buscar" alineacion="arriba">
            <input
              ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, opciones.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
                if (e.key === "Enter" && quiereCobrar && socios[marcado]) { e.preventDefault(); cobrarA(socios[marcado].socio_id); }
                else if (e.key === "Enter" && opciones[marcado]) ir(opciones[marcado].ruta);
              }}
              placeholder={buscaSocios ? (puedeCobrar ? "Socio por nombre, DNI o número… o “cobrar Juan”" : "Socio por nombre, DNI o número… o una sección") : "Ir a una sección…"}
              className="w-full bg-transparent px-5 h-16 text-lg outline-none border-b border-[var(--borde)]"
            />
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {error && <p className="px-3 py-3 text-sm pildora pildora-rojo !rounded-xl w-full">⚠️ {error}</p>}
              {socios.length > 0 && <p className="titulo-grupo px-3 pt-2 pb-1">Socios</p>}
              {soloVer && socios.map((s) => (
                // EQU-2: el profe ve nombre, foto y semáforo; no abre la ficha.
                <div key={s.socio_id} className="flex items-center gap-3 rounded-xl px-3 min-h-[56px]" data-socio-profe>
                  {s.tiene_foto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/panel/socios/${s.socio_id}/foto`} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-10 rounded-full object-cover flex-none" />
                    : <PuntoEstado color={s.color} />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold truncate">{s.nombre}</span>
                    <span className="block text-sm texto-suave truncate">{s.tiene_foto && <PuntoEstado color={s.color} />} {s.texto}</span>
                  </span>
                </div>
              ))}
              {!soloVer && socios.map((s, i) => (
                <div key={s.socio_id} className={`flex items-center gap-2 rounded-xl pr-2 ${marcado === i ? "bg-[var(--tarjeta-alta)]" : ""}`}>
                  <Link href={`/panel/socios/${s.socio_id}`} onClick={() => setAbierto(false)} className="flex items-center gap-3 px-3 min-h-[56px] min-w-0 flex-1">
                    <PuntoEstado color={s.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">{s.nombre} {s.numero != null && <span className="texto-tenue font-normal">#{s.numero}</span>}</span>
                      <span className="block text-sm texto-suave truncate">{s.texto}</span>
                    </span>
                  </Link>
                  {puedeCobrar && !s.dado_de_baja && <button type="button" className="boton !min-h-11 flex-none" data-buscador-cobrar onClick={() => cobrarA(s.socio_id)}>💵 Cobrar</button>}
                </div>
              ))}
              {buscando && socios.length === 0 && <p className="px-3 py-3 texto-tenue text-sm">Buscando…</p>}
              {secc.length > 0 && <p className="titulo-grupo px-3 pt-3 pb-1">Secciones</p>}
              {secc.map((s, i) => (
                <Link key={s.clave} href={s.ruta} onClick={() => setAbierto(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 min-h-[52px] ${marcado === (soloVer ? 0 : socios.length) + i ? "bg-[var(--tarjeta-alta)]" : ""}`}>
                  <span className="text-xl w-7 text-center" aria-hidden>{s.emoji}</span>
                  <span className="font-semibold">{s.titulo}</span>
                  <span className="texto-tenue text-sm truncate">{s.descripcion}</span>
                </Link>
              ))}
              {!buscando && q.length >= 2 && opciones.length === 0 && !error && (
                <p className="px-3 py-6 texto-suave text-center">No hay socios ni secciones con “{texto.trim()}”.</p>
              )}
            </div>
      </Hoja>
    </>
  );
}
