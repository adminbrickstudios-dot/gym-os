"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LINEA_GRUPO, type Acceso, type Grupo, type Seccion } from "@/lib/panel/secciones";
import { traerPendientes } from "@/app/panel/pendientes-acciones";
import { EVENTO_PENDIENTES, ROJOS, hayAlgo, hayRojo, numeroDe, textoNumero, type Pendientes } from "@/lib/panel/pendientes";
import { EVENTO_COBRO_HECHO } from "./cobrar/evento";
import { Buscador } from "./Buscador";
import { Icono } from "@/components/ui/Icono";

type Props = {
  gimnasio: string;
  /** URL del logo del gimnasio, si cargó uno. */
  logo?: string | null;
  persona: string;
  rol: string;
  /** La clave del rol (dueno, encargado…): el nombre de arriba es para mostrar. */
  rolClave?: string;
  secciones: Seccion[];
  grupos: Grupo[];
  principales: Acceso[];
  buscaSocios: boolean;
  /** EQU-2 (D3): el profe ve nombre, foto y semáforo, sin abrir la ficha. */
  soloVerSocios?: boolean;
  /** VD-5: Ctrl+K ofrece "Cobrar" a cada socio. */
  puedeCobrar?: boolean;
  /** Desde la dirección de la plataforma: volver a elegir gimnasio (y al super admin). */
  cambiarGimnasio?: boolean;
};

const activa = (actual: string, ruta: string) => (ruta === "/panel" ? actual === "/panel" : actual === ruta || actual.startsWith(`${ruta}/`));

/** VD-37: el número de una sección. Rojo solo si algo se pierde si no se actúa hoy; el resto, neutro. */
function Numero({ clave, n }: { clave: string; n: number }) {
  if (n <= 0) return null;
  const rojo = ROJOS.has(clave);
  return (
    <span data-pendiente={clave} data-numero={n} data-rojo={rojo ? "si" : "no"} aria-label={`${n} pendientes`}
      className={`ml-auto flex-none min-w-6 h-6 px-1.5 rounded-full text-[13px] font-bold grid place-items-center ${rojo ? "text-white" : "border border-[var(--borde)] bg-[var(--tarjeta-alta)] text-[var(--texto)]"}`}
      style={rojo ? { background: "var(--rojo)" } : undefined}>
      {textoNumero(n)}
    </span>
  );
}

function Item({ s, actual, alElegir, n = 0 }: { s: Pick<Seccion, "ruta" | "emoji" | "titulo"> & { descripcion?: string; clave?: string }; actual: string; alElegir?: () => void; n?: number }) {
  const on = activa(actual, s.ruta);
  return (
    <Link href={s.ruta} onClick={alElegir} aria-current={on ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[var(--radio)] px-3 min-h-12 py-2 transition-colors ${on ? "bg-[var(--tarjeta-alta)]" : "hover:bg-[var(--tarjeta)]"}`}>
      <span className={`text-xl w-7 text-center ${on ? "text-[var(--acento)]" : "texto-suave"}`} aria-hidden><Icono nombre={s.emoji} sistema /></span>
      <span className="min-w-0">
        <span className={`block font-semibold leading-tight ${on ? "" : "text-[var(--texto)]"}`}>{s.titulo}</span>
        {s.descripcion && <span className="block text-[13px] texto-tenue leading-snug truncate">{s.descripcion}</span>}
      </span>
      {s.clave && <Numero clave={s.clave} n={n} />}
    </Link>
  );
}

function Menu({ props, actual, alElegir, pendientes }: { props: Props; actual: string; alElegir?: () => void; pendientes: Pendientes | null }) {
  return (
    <nav aria-label="Secciones" className="space-y-6">
      <Item s={{ ruta: "/panel", emoji: "inicio", titulo: "Inicio" }} actual={actual} alElegir={alElegir} />
      {props.grupos.map((g) => {
        const items = props.secciones.filter((s) => s.grupo === g);
        if (!items.length) return null;
        const principales = items.filter((s) => !s.secundaria);
        const mas = items.filter((s) => s.secundaria);
        // Lo de "Más" queda a un toque, y se abre solo si estás parado en una de esas pantallas o hay un número adentro.
        const masAbierto = mas.some((s) => activa(actual, s.ruta) || numeroDe(pendientes, s.clave) > 0);
        return (
          <div key={g} data-grupo={g}>
            <p className="titulo-grupo px-3">{g}</p>
            <p className="px-3 mb-1.5 text-[13px] texto-tenue leading-snug">{LINEA_GRUPO[g]}</p>
            <div className="space-y-0.5">{principales.map((s) => <Item key={s.clave} s={{ ...s, descripcion: undefined }} actual={actual} alElegir={alElegir} n={numeroDe(pendientes, s.clave)} />)}</div>
            {mas.length > 0 && (
              <details key={masAbierto ? "abierto" : "cerrado"} open={masAbierto} className="mt-0.5" data-mas-grupo={g}>
                <summary className="flex items-center gap-3 rounded-[var(--radio)] px-3 min-h-12 cursor-pointer texto-suave hover:bg-[var(--tarjeta)] list-none [&::-webkit-details-marker]:hidden">
                  <span className="w-7 text-center" aria-hidden><Icono nombre="abajo" /></span>
                  <span className="font-semibold">Más</span>
                  <span className="texto-tenue text-[13px]">{mas.length}</span>
                </summary>
                <div className="space-y-0.5">{mas.map((s) => <Item key={s.clave} s={{ ...s, descripcion: undefined }} actual={actual} alElegir={alElegir} n={numeroDe(pendientes, s.clave)} />)}</div>
              </details>
            )}
          </div>
        );
      })}
      {/* VD-63: el centro de ayuda, para todos los roles (no depende de ninguna sección). */}
      <div className="space-y-0.5"><Item s={{ ruta: "/panel/ayuda", emoji: "ayuda", titulo: "Ayuda", descripcion: "Preguntas cortas y cómo se hace" }} actual={actual} alElegir={alElegir} /></div>
    </nav>
  );
}

function Salir() {
  return (
    <form action="/salir" method="post">
      <button type="submit" className="boton w-full !justify-start text-[15px]"><Icono nombre="puerta" /> Cerrar sesión</button>
    </form>
  );
}

function Logo({ url, tam }: { url?: string | null; tam: string }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${tam} w-auto flex-none rounded-lg object-contain`} />;
}

export function Navegacion(props: Props) {
  const actual = usePathname();
  const [abierto, setAbierto] = useState(false);
  const porEnlace = useRef(false);
  useEffect(() => { document.body.style.overflow = abierto ? "hidden" : ""; }, [abierto]);
  // Regla 5 (FLUIDEZ): la hoja del menú se cierra con Esc y con el "atrás" del teléfono (que cierra el menú y no saca de la pantalla).
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    const atras = () => setAbierto(false);
    const previo = history.state;
    history.pushState({ menu: 1 }, "");
    window.addEventListener("keydown", esc);
    window.addEventListener("popstate", atras);
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("popstate", atras);
      // Con la X o Esc se saca la entrada que sumó el menú. Con un enlace NO: un back() acá pisaba la navegación que el enlace estaba empezando (el menú del celular no llevaba a ningún lado); se le devuelve su estado a la entrada y listo.
      if (history.state?.menu === 1) { if (porEnlace.current) history.replaceState(previo, ""); else history.back(); }
      porEnlace.current = false;
    };
  }, [abierto]);

  // VD-37: los números salen de la base en un solo pedido. Se piden al cargar, al cambiar de pantalla,
  // al cobrar o resolver algo, y cada 60 s con la pestaña visible. Si falla se conserva el último número.
  const [pendientes, setPendientes] = useState<Pendientes | null>(null);
  useEffect(() => {
    let vivo = true;
    const pedir = () => { void traerPendientes().then((p) => { if (vivo && p) setPendientes(p); }); };
    const cuandoVuelve = () => { if (document.visibilityState === "visible") pedir(); };
    pedir();
    const cada = setInterval(cuandoVuelve, 60_000);
    document.addEventListener("visibilitychange", cuandoVuelve);
    window.addEventListener(EVENTO_PENDIENTES, pedir);
    window.addEventListener(EVENTO_COBRO_HECHO, pedir);
    return () => {
      vivo = false; clearInterval(cada);
      document.removeEventListener("visibilitychange", cuandoVuelve);
      window.removeEventListener(EVENTO_PENDIENTES, pedir);
      window.removeEventListener(EVENTO_COBRO_HECHO, pedir);
    };
  }, [actual]);

  return (
    <>
      {/* Compu: barra lateral fija */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-[var(--borde)] px-4 py-5 overflow-y-auto">
        <p className="titulo text-2xl px-3 flex items-center gap-3 min-w-0"><Logo url={props.logo} tam="h-10 max-w-28" /><span className="truncate">{props.gimnasio}</span></p>
        <div className="mt-5 mb-6"><Buscador secciones={props.secciones} buscaSocios={props.buscaSocios} soloVer={props.soloVerSocios} puedeCobrar={props.puedeCobrar} rol={props.rolClave ?? props.rol} /></div>
        <Menu props={props} actual={actual} pendientes={pendientes} />
        <div className="mt-auto pt-8 space-y-3">
          <Link href="/panel/cuenta" onClick={() => setAbierto(false)} className="block px-3 text-sm hover:underline"><Icono nombre="persona" /> <span className="font-semibold">{props.persona}</span> <span className="texto-tenue">· {props.rol}</span></Link>
          {props.cambiarGimnasio && <Link href="/elegir" className="boton w-full !justify-start text-[15px]"><Icono nombre="repetir" /> Cambiar de gimnasio</Link>}
          <Salir />
        </div>
      </aside>

      {/* Celular: barra de arriba */}
      <header className="lg:hidden sticky top-0 z-30 bg-[var(--fondo)] border-b border-[var(--borde)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <p className="titulo text-xl flex-1 flex items-center gap-2 min-w-0"><Logo url={props.logo} tam="h-8 max-w-24" /><span className="truncate">{props.gimnasio}</span></p>
          <Buscador secciones={props.secciones} buscaSocios={props.buscaSocios} soloVer={props.soloVerSocios} puedeCobrar={props.puedeCobrar} rol={props.rolClave ?? props.rol} compacto />
        </div>
      </header>

      {/* Celular: las cuatro principales + menú */}
      <nav aria-label="Principales" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--borde)] bg-[var(--fondo)] pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {props.principales.map((a) => {
            const on = activa(actual, a.ruta);
            return (
              <li key={a.clave}>
                <Link href={a.ruta} aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 h-16 text-[12px] font-semibold ${on ? "" : "texto-tenue"}`}>
                  <span className={`relative text-2xl ${on ? "" : "opacity-80"}`} aria-hidden>
                    <Icono nombre={a.emoji} sistema />
                    {numeroDe(pendientes, a.clave) > 0 && <span className="absolute -top-1 -right-2 size-2.5 rounded-full" style={{ background: ROJOS.has(a.clave) ? "var(--rojo)" : "var(--texto-tenue)" }} />}
                  </span>
                  {a.corto ?? a.titulo}
                </Link>
              </li>
            );
          })}
          <li className="col-start-5">
            <button type="button" onClick={() => setAbierto(true)} className="w-full flex flex-col items-center justify-center gap-0.5 h-16 text-[12px] font-semibold texto-tenue">
              <span className="relative text-2xl" aria-hidden>
                <Icono nombre="menu" />
                {hayAlgo(pendientes) && <span data-menu-punto={hayRojo(pendientes) ? "rojo" : "neutro"} className="absolute -top-1 -right-2 size-2.5 rounded-full" style={{ background: hayRojo(pendientes) ? "var(--rojo)" : "var(--texto-tenue)" }} />}
              </span>Menú
            </button>
          </li>
        </ul>
      </nav>

      {abierto && (
        <div className="hoja lg:hidden fixed inset-0 z-40 bg-[var(--fondo)] overflow-y-auto px-4 pt-4 pb-24" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="flex items-center justify-between mb-6">
            <p className="titulo text-2xl">Menú</p>
            <button type="button" onClick={() => setAbierto(false)} className="boton !min-h-11 !px-4" aria-label="Cerrar menú"><Icono nombre="cerrar" /></button>
          </div>
          <Menu props={props} actual={actual} alElegir={() => { porEnlace.current = true; setAbierto(false); }} pendientes={pendientes} />
          <div className="mt-8 space-y-3">
            <Link href="/panel/cuenta" onClick={() => { porEnlace.current = true; setAbierto(false); }} className="block px-3 text-sm hover:underline"><Icono nombre="persona" /> <span className="font-semibold">{props.persona}</span> <span className="texto-tenue">· {props.rol}</span></Link>
            {props.cambiarGimnasio && <Link href="/elegir" className="boton w-full !justify-start text-[15px]"><Icono nombre="repetir" /> Cambiar de gimnasio</Link>}
            <Salir />
          </div>
        </div>
      )}
    </>
  );
}
