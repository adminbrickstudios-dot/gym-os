import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "BRIK · Ver como socio" };
type Vista = {
  nombre: string; cubierto_hasta: string | null;
  acceso: { color?: string; motivo?: string; texto?: string; [k: string]: unknown };
  ultimos_pagos: { creado_en: string; monto: number; medio: string; estado: string }[];
  ultimos_ingresos: { momento: string }[];
};
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }) : "sin dato");

/** "Ver la app como este socio": solo lectura de lo que su pantalla mostraría. No entra a su cuenta y queda en el registro de BRIK. */
export default async function VerSocio({ searchParams }: { searchParams: Promise<{ g?: string; s?: string }> }) {
  if ((await headers()).get("x-gymos-contexto") !== "plataforma") redirect("/");
  const { g, s } = await searchParams;
  if (!g || !s) redirect("/admin/buscar");
  let v: Vista;
  try { v = await rpc<Vista>("admin_ver_socio", { p_gimnasio_id: g, p_socio_id: s }); }
  catch (e) {
    if (e instanceof ErrorDatos) return <main className="min-h-dvh grid place-items-center px-4"><p role="alert" className="tarjeta p-6">{e.message}</p></main>;
    throw e;
  }
  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-8 py-10 space-y-6" data-ver-socio>
      <header className="space-y-2">
        <Link href="/admin/buscar" className="texto-suave">← Buscar</Link>
        <h1 className="titular text-[28px]">{v.nombre || "Socio"}</h1>
        <p className="texto-suave">Así lo ve su app, solo para mirar: no entrás a su cuenta ni cambiás nada. Queda anotado en el registro de BRIK.</p>
      </header>
      <section className="tarjeta p-5 space-y-2">
        <h2 className="titular text-2xl">¿Puede entrar hoy?</h2>
        <p data-acceso-color>{String(v.acceso?.color ?? "")} {v.acceso?.texto ? `· ${String(v.acceso.texto)}` : ""}</p>
        {v.acceso?.motivo && <p className="texto-suave">Motivo: {String(v.acceso.motivo)}</p>}
        <p className="texto-suave">Cubierto hasta: {fecha(v.cubierto_hasta)}</p>
      </section>
      <section className="tarjeta p-5 space-y-2">
        <h2 className="titular text-2xl">Últimos pagos</h2>
        {v.ultimos_pagos.length === 0 && <p className="texto-suave">Sin pagos.</p>}
        <ul className="space-y-1">{v.ultimos_pagos.map((p) => <li key={p.creado_en}>{fecha(p.creado_en)} · {p.medio} · {p.estado}</li>)}</ul>
      </section>
      <section className="tarjeta p-5 space-y-2">
        <h2 className="titular text-2xl">Últimos ingresos</h2>
        {v.ultimos_ingresos.length === 0 && <p className="texto-suave">Sin ingresos.</p>}
        <ul className="space-y-1">{v.ultimos_ingresos.map((i) => <li key={i.momento}>{fecha(i.momento)}</li>)}</ul>
      </section>
    </main>
  );
}
