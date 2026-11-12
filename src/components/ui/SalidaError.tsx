"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icono } from "@/components/ui/Icono";

/**
 * FLUIDEZ regla 15: un aviso de error siempre ofrece "Volver" e "Ir al inicio". El inicio es el de la zona en la que está la persona
 * (panel, app del socio o super admin). Va dentro de los avisos que arma `intentar()` cuando la base dice que no.
 */
export function SalidaError({ inicio }: { inicio?: string }) {
  const router = useRouter();
  const ruta = usePathname() ?? "";
  const destino = inicio ?? (ruta.startsWith("/app") ? "/app" : ruta.startsWith("/admin") ? "/admin" : "/panel");
  return (
    <div className="flex flex-wrap gap-2 mt-6" data-salida-error>
      <button type="button" onClick={() => router.back()} className="boton">← Volver</button>
      <Link href={destino} className="boton"><Icono nombre="inicio" /> Ir al inicio</Link>
    </div>
  );
}
