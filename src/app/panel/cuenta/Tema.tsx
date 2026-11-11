"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarTema, type Tema } from "./tema-acciones";

const OPCIONES: { valor: Tema; titulo: string; ayuda: string }[] = [
  { valor: "gimnasio", titulo: "Como el gimnasio", ayuda: "Usa el fondo que eligió tu gimnasio (claro por defecto)." },
  { valor: "claro", titulo: "Claro", ayuda: "Fondo claro, letras oscuras." },
  { valor: "oscuro", titulo: "Oscuro", ayuda: "Fondo oscuro, letras claras. Descansa la vista de noche." },
];

/** BASE-6 (D37): cada persona elige claro u oscuro; vale en todos sus dispositivos (se guarda en la base y en una cookie para pintar sin esperar). */
export function Tema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const elegir = (t: Tema) => {
    setMsj(null);
    empezar(async () => {
      const r = await guardarTema(t);
      if (r.error) { setMsj({ tipo: "error", texto: r.error }); return; }
      setTema(t);
      router.refresh();   // el panel lee la cookie `tema` al dibujarse: se repinta ya
      setMsj({ tipo: "exito", texto: "Listo: tu tema quedó guardado." });
    });
  };
  return (
    <section className="tarjeta p-5 sm:p-6 max-w-xl mt-6" aria-labelledby="tema" data-tema-usuario={tema}>
      <h2 id="tema" className="titulo text-2xl mb-1">Tema</h2>
      <p className="texto-suave mb-3">Elegí cómo ves el panel. Es solo tuyo: no cambia lo que ven los demás.</p>
      <fieldset className="space-y-2" disabled={ocupado}>
        <legend className="sr-only">Tema del panel</legend>
        {OPCIONES.map((o) => (
          <label key={o.valor} className="flex items-start gap-3 min-h-11 cursor-pointer">
            <input type="radio" name="tema" className="mt-1.5" checked={tema === o.valor} onChange={() => elegir(o.valor)} />
            <span><b>{o.titulo}</b><br /><span className="texto-suave text-sm">{o.ayuda}</span></span>
          </label>
        ))}
      </fieldset>
      {msj && <div className="mt-3"><Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje></div>}
    </section>
  );
}
