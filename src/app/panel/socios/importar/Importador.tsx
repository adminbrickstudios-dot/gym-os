"use client";
// Importar en cuatro pasos en una sola pantalla: archivo → qué columna es qué
// → revisión con los errores de cada fila → importar. La base revisa y decide.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { CAMPOS, adivinarColumnas, armarFilas, celda, leerCsv, type Campo } from "@/lib/importar";
import { deshacer, importar, revisar } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Importacion = { id: string; archivo: string | null; filas: number; importados: number; creado_en: string; deshecha_en: string | null; puede_deshacer: boolean };
type PagoRevisado = { fecha: string; monto: number | string; medio: string; cuotas: number };
type Revision = { validas: number; ya_existian?: number; repetidas_en_archivo?: number; pagos?: number; monto_pagos?: number | string; filas: { fila: number; errores: string[]; datos: Record<string, string | null> & { pagos?: PagoRevisado[] } }[] };

export function Importador({ anteriores, zona }: { anteriores: Importacion[]; zona: string }) {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [titulos, setTitulos] = useState<string[]>([]);
  const [datos, setDatos] = useState<unknown[][]>([]);
  const [mapa, setMapa] = useState<(Campo | null)[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [resultado, setResultado] = useState<{ importados: number; salteados: number; ya_existian?: number; repetidas_en_archivo?: number; con_cobertura?: number; pagos_cargados?: number; monto_pagos?: number | string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [lista, setLista] = useState(anteriores);

  const leer = async (f: File) => {
    setError(null); setRevision(null); setResultado(null);
    try {
      let filas: unknown[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { default: leerExcel } = await import("read-excel-file");
        filas = (await leerExcel(f)) as unknown[][];
      } else if (/\.(csv|txt)$/i.test(f.name)) {
        filas = leerCsv(await f.text());
      } else { setError("Subí un Excel (.xlsx) o un CSV. Si tenés un .xls viejo, abrilo y guardalo como .xlsx."); return; }
      if (filas.length < 2) { setError("El archivo no tiene filas debajo de los títulos."); return; }
      const t = filas[0].map(celda);
      setArchivo(f.name); setTitulos(t); setDatos(filas.slice(1)); setMapa(adivinarColumnas(t));
    } catch (e) {
      setError(`No se pudo leer el archivo (${(e as Error).message}). Probá guardarlo como CSV desde Excel o Google Sheets ("Descargar como CSV") y subilo de nuevo.`);
    }
  };
  const filasParaBase = () => armarFilas(datos, mapa);
  const hacerRevision = () => empezar(async () => {
    setError(null); setResultado(null);
    if (!mapa.includes("nombre")) { setError("Elegí qué columna es el nombre."); return; }
    const r = await revisar(filasParaBase());
    if (r.error) { setError(r.error); return; }
    setRevision(r.revision as Revision);
  });
  const hacerImportacion = () => empezar(async () => {
    const r = await importar(filasParaBase(), archivo ?? "archivo");
    if (r.error || !r.resultado) { setError(r.error ?? "No se pudo importar"); return; }
    setResultado(r.resultado); setRevision(null); setDatos([]); setTitulos([]); setArchivo(null);
    setLista((l) => [{ id: r.resultado!.importacion_id, archivo, filas: r.resultado!.importados + r.resultado!.salteados, importados: r.resultado!.importados, creado_en: new Date().toISOString(), deshecha_en: null, puede_deshacer: r.resultado!.importados > 0 }, ...l]);
  });
  const hacerDeshacer = (id: string) => empezar(async () => {
    const r = await deshacer(id);
    if (r.error) { setError(r.error); return; }
    setLista((l) => l.map((x) => (x.id === id ? { ...x, deshecha_en: new Date().toISOString(), puede_deshacer: false } : x)));
    setResultado(null);
  });
  const conError = revision ? revision.filas.filter((f) => f.errores.some((e) => !e.startsWith("Celular repetido"))) : [];

  return (
    <div className="space-y-6" data-importador>
      <section className="tarjeta p-5 sm:p-6 space-y-3">
        <p className="titulo text-2xl">1. Tu archivo</p>
        <p className="texto-suave">Excel (.xlsx) o CSV, con los títulos en la primera fila. Sirve el que exportás de otro sistema o una planilla tuya.</p>
        <p className="text-sm texto-tenue">También podés cargar pagos de antes (hasta 3 por socio): una columna de fecha, monto y medio de pago por cada uno. Tienen que ser de días que ya pasaron.</p>
        <label className="boton boton-principal cursor-pointer w-fit">
          <Icono nombre="documento" /> Elegir archivo
          <input type="file" accept=".xlsx,.csv,.txt" className="sr-only" aria-label="Elegir archivo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ""; }} />
        </label>
        {archivo && <p className="texto-suave" data-archivo><Icono nombre="documento" /> {archivo} · {datos.length} filas</p>}
      </section>

      {titulos.length > 0 && (
        <section className="tarjeta p-5 sm:p-6 space-y-4" data-columnas>
          <p className="titulo text-2xl">2. Qué es cada columna</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {titulos.map((t, i) => (
              <label key={i} className="block space-y-1">
                <span className="etiqueta">{t || `Columna ${i + 1}`} <span className="texto-tenue font-normal">· ej.: {celda(datos[0]?.[i]) || "—"}</span></span>
                <select className="campo" value={mapa[i] ?? ""} onChange={(e) => { const v = (e.target.value || null) as Campo | null; setMapa((m) => m.map((x, j) => (j === i ? v : x === v && v ? null : x))); setRevision(null); }}>
                  <option value="">No importar</option>
                  {CAMPOS.map((c) => <option key={c.campo} value={c.campo}>{c.etiqueta}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="button" className="boton boton-principal" disabled={ocupado} onClick={hacerRevision}>{ocupado && !revision ? "Revisando…" : "Revisar"}</button>
        </section>
      )}

      {revision && (
        <section className="tarjeta p-5 sm:p-6 space-y-4" data-revision data-validas={revision.validas} data-con-error={conError.length} data-ya-existian={revision.ya_existian ?? 0} data-repetidas-archivo={revision.repetidas_en_archivo ?? 0} data-pagos={revision.pagos ?? 0}>
          <p className="titulo text-2xl">3. Revisión</p>
          <p className="text-lg"><strong>{revision.validas}</strong> listos para entrar{conError.length > 0 && <> · <strong>{conError.length}</strong> con algo para corregir (no entran)</>}.</p>
          {conError.length > 0 && (
            <ul className="space-y-2 max-h-80 overflow-auto">
              {conError.slice(0, 100).map((f) => (
                <li key={f.fila} className="rounded-xl border border-[var(--borde)] p-3" data-fila-error={f.fila}>
                  <p className="font-semibold">Fila {f.fila + 1}{f.datos.nombre ? ` · ${f.datos.nombre} ${f.datos.apellido ?? ""}` : ""}</p>
                  <p className="text-sm texto-suave">{f.errores.join(" · ")}</p>
                </li>
              ))}
            </ul>
          )}
          {revision.validas > 0 && (
            <div data-vista-previa>
              <p className="etiqueta">Así van a quedar los primeros</p>
              <ul className="space-y-1 text-sm">
                {revision.filas.filter((f) => !f.errores.some((e) => !e.startsWith("Celular repetido"))).slice(0, 5).map((f) => (
                  <li key={f.fila} className="texto-suave">
                    <strong>{f.datos.nombre} {f.datos.apellido ?? ""}</strong>{f.datos.dni ? ` · DNI ${f.datos.dni}` : ""}{f.datos.telefono ? ` · ${f.datos.telefono}` : ""}{f.datos.vence ? ` · pagó hasta ${f.datos.vence.split("-").reverse().join("/")}` : ""}{f.datos.pagos?.length ? ` · ${f.datos.pagos.length} ${f.datos.pagos.length === 1 ? "pago" : "pagos"} de ${formatearPesos(f.datos.pagos.reduce((t, p) => t + Number(p.monto), 0))}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {((revision.ya_existian ?? 0) > 0 || (revision.repetidas_en_archivo ?? 0) > 0) && (
            <p className="text-sm texto-suave" data-repetidas>
              {(revision.ya_existian ?? 0) > 0 && <>{revision.ya_existian} ya están cargados como socios (no se vuelven a crear). </>}
              {(revision.repetidas_en_archivo ?? 0) > 0 && <>{revision.repetidas_en_archivo} aparecen más de una vez en el archivo (entra la primera).</>}
            </p>
          )}
          {(revision.pagos ?? 0) > 0 && (
            <div data-aviso-pagos-pasados className="space-y-1">
              <p className="text-lg"><Icono nombre="plata" /> Se cargan <strong>{revision.pagos}</strong> pagos anteriores por <strong>{formatearPesos(revision.monto_pagos ?? 0)}</strong>.</p>
              <p className="text-sm texto-tenue">Cada pago cuenta en el Resultado del mes de su fecha y arma la cobertura como si se hubiera cobrado ese día. No entran en la caja de hoy y quedan marcados en Control como cargados por vos, con la fecha de hoy. La plata no se deshace con “Deshacer”: si un pago está mal se anula desde la ficha del socio.</p>
            </div>
          )}
          <p className="text-sm texto-tenue">“Pagó hasta” se carga como lo que ya pagó, también si ya venció: el primer día la puerta ya muestra quién debe. Quien no tiene esa fecha queda con el plan y sin pagar.</p>
          <button type="button" className="boton boton-principal" disabled={ocupado || revision.validas === 0} onClick={hacerImportacion}>
            {ocupado ? "Importando…" : `Importar ${revision.validas} socios`}
          </button>
        </section>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {resultado && (
        <Mensaje tipo="exito" accion={<Link href="/panel/socios" className="boton"><Icono nombre="usuarios" /> Ver socios</Link>}>
          <span data-importados={resultado.importados} data-pagos-cargados={resultado.pagos_cargados ?? 0}>Entraron {resultado.importados} socios{resultado.salteados ? ` (${resultado.salteados} quedaron afuera: errores o ya cargados)` : ""}.{(resultado.pagos_cargados ?? 0) > 0 ? ` Se cargaron ${resultado.pagos_cargados} pagos anteriores por ${formatearPesos(resultado.monto_pagos ?? 0)}; no entraron en la caja de hoy.` : " Si algo salió mal, deshacelo abajo durante 24 horas."}</span>
        </Mensaje>
      )}

      {lista.length > 0 && (
        <section className="space-y-2">
          <p className="titulo-grupo">Importaciones</p>
          <ul className="space-y-2">
            {lista.map((x) => (
              <li key={x.id} className="tarjeta p-4 flex flex-wrap items-center justify-between gap-3" data-importacion={x.deshecha_en ? "deshecha" : "activa"}>
                <span><strong>{x.archivo ?? "Archivo"}</strong> <span className="texto-suave">· {x.importados} socios · {fechaCorta(x.creado_en, zona)}</span>
                  {x.deshecha_en && <span className="pildora ml-2"><Icono nombre="deshacer" /> Deshecha</span>}</span>
                {x.puede_deshacer && <button type="button" className="boton" disabled={ocupado} onClick={() => hacerDeshacer(x.id)}><Icono nombre="deshacer" /> Deshacer</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
