import type { Metadata } from "next";
import Link from "next/link";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Encabezado } from "@/components/panel/Marco";
import { Pestanas } from "@/components/ui/Pestanas";
import { Vacio } from "@/components/ui/Vacio";
import { estadoDe, motivoDe, type Bandeja, type HiloPanel, type RespuestaRapida } from "@/lib/mensajes";
import { conFotos } from "@/lib/mensajes-servidor";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { PermisoRecepcion, Rapidas } from "./Ajustes";
import { Respuesta } from "./Respuesta";

export const metadata: Metadata = { title: "Mensajes" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILTROS = ["abiertos", "nuevo", "en_curso", "resuelto", "todos"] as const;

/** VD-38 (D27): la bandeja de lo que los socios le escriben al gimnasio. Dueño y encargado; la recepción si el dueño lo prendió. */
export default async function Mensajes({ searchParams }: { searchParams: Promise<{ estado?: string; hilo?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    exigirSeccion(panel, "mensajes");
    const g = panel.gimnasio.id;
    const filtro = (FILTROS as readonly string[]).includes(sp.estado ?? "") ? sp.estado! : "abiertos";
    const hiloId = UUID.test(sp.hilo ?? "") ? sp.hilo! : null;
    const gestiona = panel.yo.rol === "dueno" || panel.yo.rol === "encargado";

    // La base exige el permiso en cada una: sin permiso, error (no una bandeja vacía).
    const [bandeja, rapidas, permisos, hilo] = await Promise.all([
      rpc<Bandeja>("bandeja_mensajes", { p_gimnasio_id: g, p_estado: filtro === "todos" ? null : filtro, p_limite: 100 }),
      rpc<RespuestaRapida[]>("respuestas_rapidas", { p_gimnasio_id: g }),
      gestiona ? rpc<{ recepcion_ve: boolean }>("permisos_mensajes", { p_gimnasio_id: g }) : Promise.resolve(null),
      hiloId ? rpc<HiloPanel>("hilo_mensajes", { p_hilo_id: hiloId }) : Promise.resolve(null),
    ]);
    const mensajes = hilo ? await conFotos(hilo.mensajes) : [];
    const zona = panel.gimnasio.zona_horaria;
    const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const c = bandeja.conteos;
    const ruta = (estado: string, h?: string) => `/panel/mensajes?estado=${estado}${h ? `&hilo=${h}` : ""}`;
    const pestanas = [
      { clave: "abiertos", texto: `Abiertos (${c.nuevo + c.en_curso})`, href: ruta("abiertos") },
      { clave: "nuevo", texto: `Nuevos (${c.nuevo})`, href: ruta("nuevo") },
      { clave: "en_curso", texto: `En curso (${c.en_curso})`, href: ruta("en_curso") },
      { clave: "resuelto", texto: `Resueltos (${c.resuelto})`, href: ruta("resuelto") },
      { clave: "todos", texto: "Todos", href: ruta("todos") },
    ];

    return (
      <div data-bandeja-mensajes>
        <Encabezado emoji="💬" titulo="Mensajes"
          bajada={c.sin_responder > 0 ? `${c.sin_responder === 1 ? "1 mensaje espera" : `${c.sin_responder} mensajes esperan`} tu respuesta.` : "Consultas, quejas y objetos perdidos que los socios te escriben desde la app."} />
        <div className="space-y-4 mb-6">
          <Pestanas etiqueta="Estado de los mensajes" pestanas={pestanas} activa={filtro} />
          {gestiona && permisos && <PermisoRecepcion inicial={permisos.recepcion_ve} puedeEditar={panel.yo.rol === "dueno"} />}
          {gestiona && <Rapidas lista={rapidas} puedeEditar />}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
          <section aria-label="Bandeja" className={hilo ? "hidden lg:block" : ""}>
            {bandeja.items.length === 0 ? (
              <Vacio emoji="💬" titulo={filtro === "abiertos" ? "Sin mensajes por contestar" : "No hay mensajes acá"}>
                Cuando un socio te escriba desde su app (Yo → Escribile al gimnasio), aparece acá con un aviso.
              </Vacio>
            ) : (
              <ul className="space-y-2">
                {bandeja.items.map((h) => {
                  const m = motivoDe(h.motivo), e = estadoDe(h.estado);
                  return (
                    <li key={h.hilo_id}>
                      <Link href={ruta(filtro, h.hilo_id)} data-hilo={h.hilo_id} data-sin-responder={h.sin_responder ? "1" : "0"}
                        className={`tarjeta block p-4 ${hiloId === h.hilo_id ? "ring-2 ring-[var(--acento)]" : ""}`}>
                        <span className="flex items-center gap-2 flex-wrap">
                          <span aria-hidden>{m.emoji}</span>
                          <span className="font-semibold min-w-0 flex-1 truncate">{h.socio}</span>
                          {h.sin_responder && <span className="pildora pildora-rojo !text-xs">Sin responder</span>}
                        </span>
                        {h.extracto && <span className="block texto-suave text-[15px] truncate mt-1">{h.ultimo_autor === "equipo" ? "Vos: " : ""}{h.extracto}</span>}
                        <span className="block text-sm texto-tenue mt-1">{m.titulo} · <span className={`pildora pildora-${e.color} !text-xs`}>{e.titulo}</span> · {cuando(h.ultimo_en)}{h.con_foto ? " · 📷" : ""}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {hilo && (
            <section aria-label="Conversación" className="tarjeta p-5 space-y-4 min-w-0" data-hilo-abierto={hilo.hilo_id}>
              <Link href={ruta(filtro)} className="lg:hidden texto-suave inline-block">← Mensajes</Link>
              <div>
                <LinkPanel href={`/panel/socios/${hilo.socio_id}`} siNoEsta="texto" className="titulo text-2xl hover:underline" textoClassName="titulo text-2xl block">{hilo.socio}</LinkPanel>
                <p className="texto-suave mt-1">{motivoDe(hilo.motivo).emoji} {motivoDe(hilo.motivo).titulo} · <span className={`pildora pildora-${estadoDe(hilo.estado).color}`}>{estadoDe(hilo.estado).titulo}</span></p>
              </div>
              <ul className="space-y-3" aria-label="Mensajes del hilo">
                {mensajes.map((x) => (
                  <li key={x.id} className={`flex ${x.autor === "equipo" ? "justify-end" : "justify-start"}`} data-autor={x.autor}>
                    <div className={`rounded-[var(--radio)] border border-[var(--borde)] p-3 max-w-[92%] min-w-0 ${x.autor === "equipo" ? "bg-[var(--tarjeta-alta)]" : ""}`}>
                      <p className="text-sm texto-tenue mb-1">{x.autor === "socio" ? hilo.socio : (x.quien ?? "El gimnasio")} · {cuando(x.creado_en)}</p>
                      <p className="whitespace-pre-wrap break-words">{x.texto}</p>
                      {x.con_foto && (x.foto_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <a href={x.foto_url} target="_blank" rel="noreferrer"><img src={x.foto_url} alt="Foto del socio" className="mt-2 rounded-[var(--radio)] max-h-72 w-auto max-w-full" data-foto-hilo /></a>
                        : <p className="texto-tenue text-sm mt-2">📷 La foto no se pudo abrir ahora.</p>)}
                    </div>
                  </li>
                ))}
              </ul>
              <Respuesta hiloId={hilo.hilo_id} estado={hilo.estado} rapidas={rapidas} />
            </section>
          )}
        </div>
      </div>
    );
  });
}
