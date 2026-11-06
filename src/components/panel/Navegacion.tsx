"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Acceso, Grupo, Seccion } from "@/lib/panel/secciones";
import { Buscador } from "./Buscador";

type Props = {
  gimnasio: string;
  /** URL del logo del gimnasio, si cargó uno. */
  logo?: string | null;
  persona: string;
  rol: string;
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

function Item({ s, actual, alElegir }: { s: Pick<Seccion, "ruta" | "emoji" | "titulo"> & { descripcion?: string }; actual: string; alElegir?: () => void }) {
  const on = activa(actual, s.ruta);
  return (
    <Link href={s.ruta} onClick={alElegir} aria-current={on ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 min-h-[52px] py-2 transition-colors ${on ? "bg-[var(--tarjeta-alta)]" : "hover:bg-[var(--tarjeta)]"}`}>
      <span className="text-xl w-7 text-center" aria-hidden>{s.emoji}</span>
      <span className="min-w-0">
        <span className={`block font-semibold leading-tight ${on ? "" : "text-[var(--texto)]"}`}>{s.titulo}</span>
        {s.descripcion && <span className="block text-[13px] texto-tenue leading-snug truncate">{s.descripcion}</span>}
      </span>
    </Link>
  );
}

function Menu({ props, actual, alElegir }: { props: Props; actual: string; alElegir?: () => void }) {
  return (
    <nav aria-label="Secciones" className="space-y-6">
      <Item s={{ ruta: "/panel", emoji: "🏠", titulo: "Inicio" }} actual={actual} alElegir={alElegir} />
      {props.grupos.map((g) => {
        const items = props.secciones.filter((s) => s.grupo === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="titulo-grupo px-3 mb-1.5">{g}</p>
            <div className="space-y-0.5">{items.map((s) => <Item key={s.clave} s={s} actual={actual} alElegir={alElegir} />)}</div>
          </div>
        );
      })}
    </nav>
  );
}

function Salir() {
  return (
    <form action="/salir" method="post">
      <button type="submit" className="boton w-full !justify-start text-[15px]">🚪 Cerrar sesión</button>
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
  useEffect(() => { document.body.style.overflow = abierto ? "hidden" : ""; }, [abierto]);

  return (
    <>
      {/* Compu: barra lateral fija */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 flex-col border-r border-[var(--borde)] px-4 py-5 overflow-y-auto">
        <p className="titulo text-2xl px-3 flex items-center gap-3 min-w-0"><Logo url={props.logo} tam="h-10 max-w-28" /><span className="truncate">{props.gimnasio}</span></p>
        <div className="mt-5 mb-6"><Buscador secciones={props.secciones} buscaSocios={props.buscaSocios} soloVer={props.soloVerSocios} puedeCobrar={props.puedeCobrar} /></div>
        <Menu props={props} actual={actual} />
        <div className="mt-auto pt-8 space-y-3">
          <Link href="/panel/cuenta" onClick={() => setAbierto(false)} className="block px-3 text-sm hover:underline">👤 <span className="font-semibold">{props.persona}</span> <span className="texto-tenue">· {props.rol}</span></Link>
          {props.cambiarGimnasio && <Link href="/elegir" className="boton w-full !justify-start text-[15px]">🔁 Cambiar de gimnasio</Link>}
          <Salir />
        </div>
      </aside>

      {/* Celular: barra de arriba */}
      <header className="lg:hidden sticky top-0 z-30 backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_85%,transparent)] border-b border-[var(--borde)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <p className="titulo text-xl flex-1 flex items-center gap-2 min-w-0"><Logo url={props.logo} tam="h-8 max-w-24" /><span className="truncate">{props.gimnasio}</span></p>
          <Buscador secciones={props.secciones} buscaSocios={props.buscaSocios} soloVer={props.soloVerSocios} puedeCobrar={props.puedeCobrar} compacto />
        </div>
      </header>

      {/* Celular: las cuatro principales + menú */}
      <nav aria-label="Principales" className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--borde)] bg-[color-mix(in_oklab,var(--fondo)_92%,transparent)] backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {props.principales.map((a) => {
            const on = activa(actual, a.ruta);
            return (
              <li key={a.clave}>
                <Link href={a.ruta} aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 h-16 text-[12px] font-semibold ${on ? "" : "texto-tenue"}`}>
                  <span className={`text-2xl ${on ? "" : "grayscale-[40%] opacity-80"}`} aria-hidden>{a.emoji}</span>
                  {a.titulo}
                </Link>
              </li>
            );
          })}
          <li className="col-start-5">
            <button type="button" onClick={() => setAbierto(true)} className="w-full flex flex-col items-center justify-center gap-0.5 h-16 text-[12px] font-semibold texto-tenue">
              <span className="text-2xl" aria-hidden>☰</span>Menú
            </button>
          </li>
        </ul>
      </nav>

      {abierto && (
        <div className="hoja lg:hidden fixed inset-0 z-40 bg-[var(--fondo)] overflow-y-auto px-4 pt-4 pb-24" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="flex items-center justify-between mb-6">
            <p className="titulo text-2xl">Menú</p>
            <button type="button" onClick={() => setAbierto(false)} className="boton !min-h-11 !px-4" aria-label="Cerrar menú">✕</button>
          </div>
          <Menu props={props} actual={actual} alElegir={() => setAbierto(false)} />
          <div className="mt-8 space-y-3">
            <Link href="/panel/cuenta" onClick={() => setAbierto(false)} className="block px-3 text-sm hover:underline">👤 <span className="font-semibold">{props.persona}</span> <span className="texto-tenue">· {props.rol}</span></Link>
            {props.cambiarGimnasio && <Link href="/elegir" className="boton w-full !justify-start text-[15px]">🔁 Cambiar de gimnasio</Link>}
            <Salir />
          </div>
        </div>
      )}
    </>
  );
}
