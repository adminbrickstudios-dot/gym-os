import Link from "next/link";
import { GrillaAccesos } from "@/components/panel/GrillaAccesos";
import { fechaLarga, formatearNumero, formatearPesos, saludo } from "@/lib/formato";
import { accesosDisponibles, accesosElegidos } from "@/lib/panel/secciones";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Numero = { clave: string; emoji: string; etiqueta: string; valor: number; formato?: "pesos" };
type Ahora = { tipo: string; emoji: string; titulo: string; detalle?: string; hora?: string; href?: string; tono?: string };
type Inicio = { hoy: string; numeros: Numero[]; ahora: Ahora[] };

// Las rutas que devuelve la base son relativas al panel.
const enPanel = (href?: string) => (href ? `/panel${href}` : undefined);

export default async function Inicio() {
  return intentar(async () => {
    const panel = await contextoPanel();
    const { rol } = panel.yo;
    const datos = await rpc<Inicio>("panel_inicio", { p_gimnasio_id: panel.gimnasio.id });
    const { elegidos, perdidos } = accesosElegidos(rol, panel.secciones_apagadas, panel.yo.accesos);
    const zona = panel.gimnasio.zona_horaria;

    return (
      <div className="space-y-10 sm:space-y-12">
        <header>
          <h1 className="titular text-5xl sm:text-7xl">{saludo(new Date(), zona)}, {panel.yo.nombre} 👋</h1>
          <p className="texto-suave text-lg mt-3 first-letter:uppercase">{fechaLarga(new Date(), zona)} · {panel.gimnasio.nombre}</p>
        </header>

        <GrillaAccesos elegidos={elegidos} disponibles={accesosDisponibles(rol, panel.secciones_apagadas)} perdidos={perdidos} />

        <section aria-label="Números de hoy">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
            {datos.numeros.map((n) => (
              <div key={n.clave}>
                <dd className="numero text-5xl sm:text-6xl">{n.formato === "pesos" ? formatearPesos(n.valor) : formatearNumero(n.valor)}</dd>
                <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden>{n.emoji}</span> {n.etiqueta}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="ahora">
          <h2 id="ahora" className="titulo text-3xl mb-4">Ahora y lo que sigue</h2>
          {datos.ahora.length === 0 ? (
            <p className="texto-suave text-lg">Nada pendiente por ahora. ✨</p>
          ) : (
            <ul className="space-y-2">
              {datos.ahora.map((a, i) => {
                const contenido = (
                  <>
                    <span className="icono" aria-hidden>{a.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg leading-tight">{a.titulo}</span>
                      {a.detalle && <span className="block texto-suave text-[15px] truncate">{a.detalle}</span>}
                    </span>
                    {a.hora && <span className="numero text-2xl">{a.hora}</span>}
                    {a.tono && !a.hora && <span className="size-2.5 rounded-full" style={{ background: `var(--${a.tono})` }} aria-hidden />}
                  </>
                );
                const clase = "tarjeta flex items-center gap-4 px-4 py-3 min-h-[68px]";
                const href = enPanel(a.href);
                return (
                  <li key={`${a.tipo}-${i}`}>
                    {href ? <Link href={href} className={`${clase} hover:bg-[var(--tarjeta-alta)] transition-colors`}>{contenido}</Link> : <div className={clase}>{contenido}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    );
  });
}
