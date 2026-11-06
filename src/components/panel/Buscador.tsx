"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { crearTareaRapida } from "@/app/panel/tareas/acciones";
import type { Seccion } from "@/lib/panel/secciones";
import { accionesPara, comandoPermitido, ejemplosDe, NECESITA_ARG, sinAcentos, sinVerboIr, verbosPermitidos, type Accion } from "@/lib/panel/comandos";
import { Hoja } from "@/components/ui/Hoja";
import { PuntoEstado } from "./Estado";
import { abrirCobrar } from "./cobrar/evento";
import { EVENTO_ABRIR_ENTRADA_CON } from "./VentanaEntrada";

/** Una fila de la lista: lo que Enter hace con ella. */
type Fila =
  | { grupo: "Acciones"; clave: string; accion: Accion }
  | { grupo: "Socios"; clave: string; socio: ResultadoSocio }
  | { grupo: "Pantallas"; clave: string; seccion: Seccion };

/**
 * Ctrl+K: ir a una pantalla, abrir la ficha de un socio o hacer una acción ("cobrar juan", "entrada 12345678",
 * "nuevo socio", "tarea llamar a Pedro"). VD-29: lo que se ofrece sale de las secciones que ve el rol (nada de
 * una lista de permisos aparte) y el intérprete es `lib/panel/comandos.ts`.
 */
export function Buscador({ secciones, buscaSocios, compacto = false, soloVer = false, puedeCobrar = false }: { secciones: Seccion[]; buscaSocios: boolean; compacto?: boolean; soloVer?: boolean; puedeCobrar?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [socios, setSocios] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [buscando, empezar] = useTransition();
  const [haciendo, hacer] = useTransition();
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
  useEffect(() => { if (abierto) { setTimeout(() => campo.current?.focus(), 0); } else { setTexto(""); setSocios([]); setError(null); setAviso(null); } }, [abierto]);

  // Qué puede hacer esta persona, y si lo escrito es un comando suyo (si no, es una búsqueda común).
  const permitidos = useMemo(() => verbosPermitidos(secciones, { puedeCobrar: puedeCobrar && buscaSocios, soloVer }), [secciones, puedeCobrar, buscaSocios, soloVer]);
  const pedido = comandoPermitido(texto, permitidos);
  // "cobrar" a secas no cobra a nadie: sigue siendo una búsqueda común (como siempre) con una pista de qué falta.
  const cmd = pedido && (pedido.arg || !NECESITA_ARG.includes(pedido.verbo)) ? pedido : null;
  const pista = pedido && !cmd ? pedido : null;
  const buscaPorSocio = !!cmd && !!cmd.arg && (cmd.verbo === "cobrar" || cmd.verbo === "ficha" || cmd.verbo === "vender");
  const consulta = (cmd ? (buscaPorSocio ? cmd.arg : "") : texto).trim();

  useEffect(() => {
    if (!buscaSocios || consulta.length < 2) { setSocios([]); setError(null); return; }
    let vigente = true;
    const t = setTimeout(() => empezar(async () => {
      const r = await buscarSociosRapido(consulta);
      if (!vigente) return;   // una respuesta vieja no pisa a la nueva
      setSocios(r.socios ?? []);
      setError(r.error ?? null);
    }), 120);
    return () => { vigente = false; clearTimeout(t); };
  }, [consulta, buscaSocios]);

  // Pantallas: por lo escrito sin el "ir a / abrir / ver"; si el comando lleva un argumento, por el argumento.
  const sinPantallas = !!cmd && (cmd.verbo === "tarea" || cmd.verbo === "entrada");
  const q = sinAcentos(cmd && cmd.arg ? cmd.arg : sinVerboIr(texto));
  const secc = sinPantallas ? [] : q ? secciones.filter((s) => sinAcentos(`${s.titulo} ${s.descripcion} ${s.tambien ?? ""}`).includes(q)) : secciones;

  const acciones = accionesPara(texto, cmd, permitidos, buscaPorSocio ? socios : []);
  const sociosVisibles = buscaPorSocio || soloVer ? [] : socios;   // con "cobrar juan" los socios YA son las acciones
  const filas: Fila[] = [
    ...acciones.map((a): Fila => ({ grupo: "Acciones", clave: a.id, accion: a })),
    ...sociosVisibles.map((s): Fila => ({ grupo: "Socios", clave: s.socio_id, socio: s })),
    ...secc.map((s): Fila => ({ grupo: "Pantallas", clave: s.clave, seccion: s })),
  ];
  const tope = filas.length;
  useEffect(() => setMarcado(0), [texto, socios.length]);
  useEffect(() => { document.querySelector("[data-fila-marcada]")?.scrollIntoView({ block: "nearest" }); }, [marcado, tope]);

  const ir = (ruta: string) => { setAbierto(false); router.push(ruta); };
  const cobrarA = (socioId: string) => { setAbierto(false); abrirCobrar({ socioId, origen: "buscador" }); };
  const ejecutar = (a: Accion) => {
    if (a.tipo === "ir") return ir(a.ruta);
    if (a.tipo === "cobrar" && a.socioId) return cobrarA(a.socioId);
    if (a.tipo === "entrada") {
      setAbierto(false);
      // Con la ventana montada se abre ahí mismo; si no (pantalla de Entrada, sin sede), lleva a la pantalla de siempre.
      if (document.documentElement.dataset.ventanaEntrada === "si") window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_ENTRADA_CON, { detail: a.texto ?? "" }));
      else router.push("/panel/entrada");
      return;
    }
    if (a.tipo === "tarea" && a.texto) {
      const que = a.texto;
      setError(null); setAviso(null);
      hacer(async () => {
        const r = await crearTareaRapida(que);
        if (r.error) { setError(r.error); return; }
        setAviso(`Anotada para hoy: ${que}`);
        setTexto("");
        router.refresh();
        setTimeout(() => campo.current?.focus(), 0);
      });
    }
  };
  const enter = () => {
    const f = filas[marcado];
    if (!f) return;
    if (f.grupo === "Acciones") ejecutar(f.accion);
    else if (f.grupo === "Socios") ir(`/panel/socios/${f.socio.socio_id}`);
    else ir(f.seccion.ruta);
  };

  const ejemplos = ejemplosDe(permitidos);
  const marca = (i: number) => (marcado === i ? "bg-[var(--tarjeta-alta)]" : "");
  const placeholder = !buscaSocios ? "Ir a una sección…" : puedeCobrar ? "Socio, DNI, sección o acción: “cobrar Juan”" : "Socio por nombre, DNI o número… o una sección";
  const encabezado = (i: number) => (i === 0 || filas[i - 1].grupo !== filas[i].grupo) ? <p className="titulo-grupo px-3 pt-3 pb-1">{filas[i].grupo}</p> : null;

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
              ref={campo} value={texto} onChange={(e) => { setTexto(e.target.value); setAviso(null); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, Math.max(tope - 1, 0))); }
                if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
                if (e.key === "Enter" && !haciendo) { e.preventDefault(); enter(); }
              }}
              placeholder={placeholder} autoComplete="off" data-buscador-campo
              className="w-full bg-transparent px-5 h-16 text-lg outline-none border-b border-[var(--borde)]"
            />
            <div className="max-h-[60vh] overflow-y-auto p-2" data-buscador-lista>
              {error && <p className="px-3 py-3 text-sm pildora pildora-rojo !rounded-xl w-full">⚠️ {error}</p>}
              {aviso && <p className="px-3 py-3 text-sm pildora pildora-verde !rounded-xl w-full" role="status" data-buscador-tarea-ok>✓ {aviso}</p>}
              {pista && <p className="px-3 py-2 text-sm texto-suave" data-buscador-pista>Falta {pista.verbo === "tarea" ? "qué hay que hacer" : pista.verbo === "entrada" ? "el DNI o el nombre" : "a quién"}: escribí algo más después de “{texto.trim()}”.</p>}
              {!texto.trim() && ejemplos.length > 0 && (
                <div className="px-3 pt-2 pb-1" data-buscador-ejemplos>
                  <p className="titulo-grupo pb-1">Probá escribir</p>
                  <div className="flex flex-wrap gap-2">
                    {ejemplos.map((e) => <button key={e} type="button" className="pildora !min-h-9" onClick={() => { setTexto(e); campo.current?.focus(); }}>{e}</button>)}
                  </div>
                </div>
              )}
              {soloVer && socios.length > 0 && <p className="titulo-grupo px-3 pt-2 pb-1">Socios</p>}
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
              {filas.map((f, i) => {
                const cab = encabezado(i);
                const marcaProps = marcado === i ? { "data-fila-marcada": "" } : {};
                if (f.grupo === "Acciones") {
                  const a = f.accion;
                  const cuerpo = (
                    <>
                      <span className="text-xl w-7 text-center flex-none" aria-hidden>{a.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold truncate">{a.titulo}</span>
                        {a.detalle && <span className="block text-sm texto-suave truncate">{a.detalle}</span>}
                      </span>
                      {marcado === i && <kbd className="text-xs texto-tenue font-sans flex-none hidden sm:block">Enter</kbd>}
                    </>
                  );
                  const clases = `flex items-center gap-3 rounded-xl px-3 min-h-[56px] w-full text-left ${marca(i)}`;
                  return (
                    <div key={`a-${f.clave}`}>
                      {cab}
                      {a.tipo === "ir"
                        ? <Link href={a.ruta} onClick={() => setAbierto(false)} className={clases} data-buscador-accion={a.verbo} {...marcaProps}>{cuerpo}</Link>
                        : <button type="button" onClick={() => ejecutar(a)} disabled={haciendo} className={clases} data-buscador-accion={a.verbo} {...(a.tipo === "cobrar" ? { "data-buscador-cobrar": "" } : {})} {...marcaProps}>{cuerpo}</button>}
                    </div>
                  );
                }
                if (f.grupo === "Socios") {
                  const s = f.socio;
                  return (
                    <div key={`s-${f.clave}`}>
                      {cab}
                      <div className={`flex items-center gap-2 rounded-xl pr-2 ${marca(i)}`} {...marcaProps}>
                        <Link href={`/panel/socios/${s.socio_id}`} onClick={() => setAbierto(false)} className="flex items-center gap-3 px-3 min-h-[56px] min-w-0 flex-1">
                          <PuntoEstado color={s.color} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold truncate">{s.nombre} {s.numero != null && <span className="texto-tenue font-normal">#{s.numero}</span>}</span>
                            <span className="block text-sm texto-suave truncate">{s.texto}</span>
                          </span>
                        </Link>
                        {puedeCobrar && !s.dado_de_baja && <button type="button" className="boton !min-h-11 flex-none" data-buscador-cobrar onClick={() => cobrarA(s.socio_id)}>💵 Cobrar</button>}
                      </div>
                    </div>
                  );
                }
                const s = f.seccion;
                return (
                  <div key={`p-${f.clave}`}>
                    {cab}
                    <Link href={s.ruta} onClick={() => setAbierto(false)} {...marcaProps}
                      className={`flex items-center gap-3 rounded-xl px-3 min-h-[52px] ${marca(i)}`}>
                      <span className="text-xl w-7 text-center flex-none" aria-hidden>{s.emoji}</span>
                      <span className="font-semibold flex-none">{s.titulo}</span>
                      <span className="texto-tenue text-sm truncate">{s.descripcion}</span>
                    </Link>
                  </div>
                );
              })}
              {(buscando || haciendo) && (buscaPorSocio ? acciones.length === 0 : socios.length === 0) && <p className="px-3 py-3 texto-tenue text-sm">{haciendo ? "Anotando…" : "Buscando…"}</p>}
              {!buscando && !haciendo && q.length >= 2 && tope + (soloVer ? socios.length : 0) === 0 && !error && (
                <p className="px-3 py-6 texto-suave text-center">No hay socios ni pantallas con “{texto.trim()}”.</p>
              )}
            </div>
      </Hoja>
    </>
  );
}
