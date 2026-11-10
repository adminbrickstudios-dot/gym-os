// VD-26 · La página de Gym OS (la dirección de la plataforma, sin gimnasio): una landing corta para
// venderle Gym OS a dueños de gimnasios. Componente de servidor: cero JS salvo el formulario de la demo.
// Las "capturas" son ilustraciones en CSS (no fotos pesadas) y no llevan cifras ni nombres inventados.
import Image from "next/image";
import { formatearPesos } from "@/lib/formato";
import { FormDemo } from "./FormDemo";
import { Icono } from "@/components/ui/Icono";

export type PlanBrikPublico = { nombre: string; precio_mensual: number | string };

const PREGUNTAS: [string, string][] = [
  ["¿Tengo que cambiar todo de golpe?", "No. Cargás tus socios (o los importás de una planilla), tus planes y tus horarios, y empezás a usarlo en recepción. Te acompañamos en el arranque."],
  ["¿Qué pasa si se corta internet en la puerta?", "La entrada sigue andando: la recepción trabaja con una copia calculada por la base y, cuando vuelve la conexión, todo se registra."],
  ["¿Mis socios tienen que instalar algo?", "No. Entran con un código QR o con su número, y si quieren ven su estado y reservan desde el celular, sin descargar nada."],
  ["¿Cada gimnasio tiene su propia marca?", "Sí. Cada gimnasio tiene su dirección, su logo, sus colores y su página, y decide qué secciones prender."],
  ["¿Los datos de mi gimnasio quedan separados de los de otros?", "Sí. Cada gimnasio ve solo lo suyo; esa separación la hace la base de datos, no la pantalla."],
  ["¿Cómo se paga Base?", "Con un abono mensual. Pedí la demo y te contamos cómo sería para tu gimnasio."],
];

/** El semáforo de la puerta: lo que ve la recepción al tipear un número. */
function IlustracionEntrada() {
  const filas: [string, string, string][] = [
    ["var(--verde)", "Puede entrar", "Cuota al día"],
    ["var(--amarillo)", "Entra, pero avisale", "La cuota vence pronto"],
    ["var(--rojo)", "No puede entrar", "Cuota vencida · cobrala en un toque"],
  ];
  return (
    <div className="tarjeta p-4 space-y-2" role="img" aria-label="Ejemplo: la pantalla de entrada muestra en verde, amarillo o rojo si el socio puede entrar, y por qué">
      {filas.map(([c, t, m]) => (
        <div key={t} className="flex items-center gap-3 rounded-[var(--radio)] border border-[var(--borde)] p-3">
          <span className="size-9 shrink-0 rounded-full" style={{ background: c }} aria-hidden />
          <span className="min-w-0"><span className="block font-semibold">{t}</span><span className="block text-sm texto-suave">{m}</span></span>
        </div>
      ))}
    </div>
  );
}

/** Cobrar: una venta con el total y un solo botón. */
function IlustracionCobro() {
  return (
    <div className="tarjeta p-4 space-y-3" role="img" aria-label="Ejemplo: la pantalla de cobro muestra el plan, el medio de pago y un botón grande de cobrar">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radio)] border border-[var(--borde)] p-3">
        <span className="font-semibold">Cuota del mes</span><span className="h-4 w-20 rounded bg-[var(--borde)]" aria-hidden />
      </div>
      <div className="flex gap-2" aria-hidden>
        {["Efectivo", "Transferencia", "Tarjeta"].map((m, i) => (
          <span key={m} className={`flex-1 text-center text-sm rounded-[var(--radio)] border py-2 ${i === 0 ? "border-[var(--acento)]" : "border-[var(--borde)] texto-suave"}`}>{m}</span>
        ))}
      </div>
      <p className="boton boton-principal w-full pointer-events-none" aria-hidden><Icono nombre="ok" /> Cobrar</p>
    </div>
  );
}

/** Retención: la lista de quién dejó de venir, con un botón para escribirle. */
function IlustracionRetencion() {
  return (
    <div className="tarjeta p-4 space-y-2" role="img" aria-label="Ejemplo: la lista de socios que dejaron de venir, con un botón para escribirles por WhatsApp">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--radio)] border border-[var(--borde)] p-3">
          <span className="size-9 shrink-0 rounded-full bg-[var(--borde)]" aria-hidden />
          <span className="min-w-0 flex-1 space-y-1.5" aria-hidden><span className="block h-3 w-3/5 rounded bg-[var(--borde)]" /><span className="block h-2.5 w-2/5 rounded bg-[var(--borde)] opacity-60" /></span>
          <span className="pildora pildora-amarillo shrink-0">Hace tiempo que no viene</span>
        </div>
      ))}
      <p className="text-sm texto-suave pt-1">Con un toque le escribís por WhatsApp.</p>
    </div>
  );
}

/** Capturas reales del demo (las genera scripts/capturas-pagina-gymos.mjs y deja la lista en src/lib/capturas-gymos.json). */
export type CapturaGymOS = { archivo: string; ancho: number; alto: number; alt: string; titulo: string };

function Capturas({ capturas }: { capturas: CapturaGymOS[] }) {
  if (!capturas.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-8 py-12 space-y-6" aria-labelledby="capturas" data-capturas-gymos>
      <p id="capturas" className="titulo-grupo">Así se ve, de verdad</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {capturas.map((c) => (
          <li key={c.archivo} className="space-y-2">
            {/* Tamaño reservado (ancho y alto): la captura carga sin mover la página. */}
            <Image src={c.archivo} alt={c.alt} width={c.ancho} height={c.alto} sizes="(min-width: 640px) 512px, 100vw" loading="lazy" quality={72}
              className="w-full h-auto rounded-[var(--radio-grande)] border border-[var(--borde)]" />
            <p className="texto-suave text-sm">{c.titulo}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlataformaLanding({ planes, linkDemo = null, capturas = [] }: { planes: PlanBrikPublico[]; linkDemo?: string | null; capturas?: CapturaGymOS[] }) {
  return (
    <main className="overflow-x-clip" data-plataforma>
      <header className="mx-auto max-w-5xl px-4 sm:px-8 pt-5 flex items-center justify-between gap-3">
        <span className="titulo text-2xl"><Icono nombre="pesa" /> Base</span>
        <a href="/ingresar" className="boton boton-chico" data-ingresar><Icono nombre="llave" /> Ingresar</a>
      </header>

      <section className="mx-auto max-w-5xl px-4 sm:px-8 pt-12 pb-16 aparecer">
        <p className="pildora pildora-azul mb-5">Para dueños de gimnasios</p>
        <h1 className="titular text-[clamp(2.5rem,9vw,5.5rem)] max-w-[18ch]">¿Este socio puede entrar hoy?</h1>
        <p className="texto-suave text-xl sm:text-2xl mt-6 max-w-[34ch]">
          Base responde eso en un segundo, te deja cobrar en un toque y te avisa quién dejó de venir.
        </p>
        <ul className="mt-7 space-y-2 text-lg max-w-[40ch]" data-tres-lineas>
          <li><strong>Quién entra:</strong> verde, amarillo o rojo, con el motivo escrito.</li>
          <li><strong>Quién paga:</strong> cobrás en un toque y la caja cierra sola.</li>
          <li><strong>Quién dejó de venir:</strong> la lista para escribirle a tiempo.</li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-9">
          <a href="#demo" className="boton boton-principal text-lg px-8" data-quiero-demo><Icono nombre="persona" /> Quiero una demo</a>
          {linkDemo && <a href={linkDemo} target="_blank" rel="noopener noreferrer" className="boton text-lg" data-demo-whatsapp><Icono nombre="mensaje" /> Pedí una demo por WhatsApp</a>}
          <a href="#que-resuelve" className="boton text-lg">Ver qué resuelve</a>
        </div>
      </section>

      <section id="que-resuelve" className="mx-auto max-w-5xl px-4 sm:px-8 py-12 space-y-14">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <p className="titulo-grupo">En la puerta</p>
            <h2 className="titulo text-3xl sm:text-4xl">Verde, amarillo o rojo. Y por qué.</h2>
            <p className="texto-suave text-lg">La recepción tipea un número o escanea el QR y ve al instante si el socio puede entrar, con el motivo escrito. La misma respuesta en recepción, en el kiosco y en la app del socio.</p>
          </div>
          <IlustracionEntrada />
        </div>
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3 md:order-2">
            <p className="titulo-grupo">En el mostrador</p>
            <h2 className="titulo text-3xl sm:text-4xl">Cobrar en un toque.</h2>
            <p className="texto-suave text-lg">Cuota, producto o pase diario: elegís el medio de pago y listo. La caja del día queda con lo que realmente se cobró, sin planillas.</p>
          </div>
          <div className="md:order-1"><IlustracionCobro /></div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <p className="titulo-grupo">Para que no se vayan</p>
            <h2 className="titulo text-3xl sm:text-4xl">Quién dejó de venir, antes de perderlo.</h2>
            <p className="texto-suave text-lg">Una lista de los socios que bajaron la asistencia, para escribirles a tiempo desde el mismo sistema.</p>
          </div>
          <IlustracionRetencion />
        </div>
      </section>

      <Capturas capturas={capturas} />

      <section className="mx-auto max-w-5xl px-4 sm:px-8 py-12 space-y-6">
        <p className="titulo-grupo">Pensado para cada gimnasio</p>
        <ul className="grid gap-3 sm:grid-cols-3">
          {([["", "Tu marca", "Tu dirección, tu logo y tus colores. Tu página con tus planes y horarios."],
             ["", "Sin instalar nada", "Tus socios entran con QR y miran su estado desde el celular."],
             ["", "No se frena", "Si se corta internet, la puerta sigue andando y todo se registra al volver."]] as const).map(([e, t, d]) => (
            <li key={t} className="tarjeta p-5 space-y-2"><p className="text-3xl" aria-hidden><Icono nombre={e} /></p><p className="titulo text-xl">{t}</p><p className="texto-suave">{d}</p></li>
          ))}
        </ul>
      </section>

      {planes.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 sm:px-8 py-12 space-y-6" data-planes-brik>
          <p className="titulo-grupo">Abono mensual</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((p) => (
              <li key={p.nombre} className="tarjeta p-6 space-y-1" data-plan-brik>
                <p className="titulo text-2xl break-words">{p.nombre}</p>
                <p className="numero text-4xl">{formatearPesos(Number(p.precio_mensual))}</p>
                <p className="texto-tenue text-sm">por mes, por gimnasio</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 sm:px-8 py-12 space-y-4" aria-labelledby="preguntas">
        <p id="preguntas" className="titulo-grupo">Preguntas frecuentes</p>
        <div className="space-y-2">
          {PREGUNTAS.map(([p, r]) => (
            <details key={p} className="tarjeta p-4 group">
              <summary className="cursor-pointer font-semibold min-h-[44px] flex items-center">{p}</summary>
              <p className="texto-suave mt-2">{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-3xl px-4 sm:px-8 py-12 space-y-5 scroll-mt-6">
        <h2 className="titular text-4xl sm:text-5xl">Pedí tu demo</h2>
        <p className="texto-suave text-lg">Dejanos tus datos y te mostramos Base funcionando, con el ejemplo de un gimnasio como el tuyo.</p>
        <FormDemo />
        {linkDemo && <p className="texto-suave">¿Preferís WhatsApp? <a href={linkDemo} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Escribinos y te mostramos Base</a>.</p>}
      </section>

      <footer className="mx-auto max-w-5xl px-4 sm:px-8 py-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--borde)]">
        <p className="texto-tenue">Base · una línea de BRIK</p>
        <a href="/ingresar" className="boton"><Icono nombre="llave" /> Ingresar</a>
      </footer>
    </main>
  );
}
