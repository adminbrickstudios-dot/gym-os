import { Aviso } from "@/components/panel/Marco";
import { Icono } from "@/components/ui/Icono";
import { linkWhatsapp } from "@/lib/landing-textos";

export type EstadoGimnasioAviso = { pausado: boolean; baja: boolean; demo_vencida: boolean; whatsapp_brik: string | null };

const TEXTOS = {
  demo_vencida: { icono: "reloj", titulo: "Esta demo venció", cuerpo: "La prueba de este gimnasio terminó y ya no se puede abrir. Si querés seguir con Base, hablá con BRIK y la dejamos funcionando.", mensaje: "Hola, mi demo de Base venció y quiero seguir." },
  baja: { icono: "candado", titulo: "Este gimnasio está dado de baja", cuerpo: "Sus datos están guardados pero no se puede usar. Si fue un error o querés volver, hablá con BRIK.", mensaje: "Hola, mi gimnasio figura dado de baja en Base y quiero volver." },
  pausado: { icono: "pausa", titulo: "Este gimnasio está pausado", cuerpo: "El uso del panel está detenido por ahora y tus datos están a salvo. Hablá con BRIK para reactivarlo.", mensaje: "Hola, mi gimnasio figura pausado en Base y quiero reactivarlo." },
} as const;

/** F2.6: lo que se ve en lugar del panel cuando el gimnasio está pausado, dado de baja o es una demo vencida. Con el WhatsApp de BRIK si el super admin lo cargó. */
export function PantallaEstadoGimnasio({ estado, nombre }: { estado: EstadoGimnasioAviso; nombre: string }) {
  const clave = estado.demo_vencida ? "demo_vencida" : estado.baja ? "baja" : "pausado";
  const t = TEXTOS[clave];
  const wa = linkWhatsapp(estado.whatsapp_brik, `${t.mensaje} (${nombre})`);
  return (
    <main className="min-h-dvh flex items-center px-4" data-estado-gimnasio={clave}>
      <div className="mx-auto w-full max-w-xl">
        <Aviso icono={t.icono} titulo={t.titulo}>
          {t.cuerpo}
          <div className="mt-6 flex flex-wrap gap-2">
            {wa && <a href={wa} className="boton boton-principal" data-hablar-brik><Icono nombre="mensaje" /> Hablar con BRIK</a>}
            <form action="/salir" method="post"><button className="boton"><Icono nombre="puerta" /> Cerrar sesión</button></form>
          </div>
        </Aviso>
      </div>
    </main>
  );
}
