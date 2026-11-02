import type { Metadata } from "next";
import Link from "next/link";
import { PuntoEstado } from "@/components/panel/Estado";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Socios" };

type Fila = { socio_id: string; numero: number; nombre: string; telefono: string | null; dni: string | null; plan: string | null; color: string; texto: string; dado_de_baja: boolean };

export default async function Socios({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const filas = await rpc<Fila[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: q, p_limite: 60 });
    return (
      <>
        <Encabezado emoji="👥" titulo="Socios" bajada="Buscá por nombre, DNI, teléfono o número."
          accion={<Link href="/panel/socios/nuevo" className="boton boton-principal">➕ Nuevo socio</Link>} />
        <form className="mb-6" role="search">
          <input name="q" defaultValue={q} placeholder="🔍 Buscar socio" className="campo !min-h-14 !text-lg" aria-label="Buscar socio" autoComplete="off" />
        </form>
        {filas.length === 0 ? (
          <p className="texto-suave text-lg">{q ? <>Nadie con “{q}”. <Link href="/panel/socios/nuevo" className="underline">Darlo de alta</Link></> : "Todavía no hay socios. Empezá por dar de alta al primero."}</p>
        ) : (
          <ul className="space-y-2">
            {filas.map((s) => (
              <li key={s.socio_id}>
                <Link href={`/panel/socios/${s.socio_id}`} className={`tarjeta flex items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] ${s.dado_de_baja ? "opacity-60" : ""}`}>
                  <PuntoEstado color={s.color} grande />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-lg truncate">{s.nombre} <span className="texto-tenue font-normal">#{s.numero}</span></span>
                    <span className="block texto-suave truncate">{s.dado_de_baja ? "Dado de baja" : s.texto}</span>
                  </span>
                  {s.plan && <span className="hidden sm:inline pildora">{s.plan}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {filas.length === 60 && <p className="texto-tenue mt-4">Se muestran los primeros 60. Buscá para encontrar a alguien en particular.</p>}
      </>
    );
  });
}
