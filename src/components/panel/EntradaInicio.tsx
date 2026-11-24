"use client";
// Pista Semáforo (inicio-panel.png) · la tarjeta ENTRADA del Inicio: el DNI o el QR se escribe acá mismo y abre la ventana de Entrada
// con eso (el mismo camino que Ctrl+K "entrada 123…" y la barrita: no hay una entrada nueva). Cobrar, Alta y Pase diario a un toque.
// Si la ventana no está montada (sin sede activa), va a la pantalla de Entrada de siempre con lo escrito.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icono } from "@/components/ui/Icono";
import { EVENTO_ABRIR_ENTRADA_CON } from "./entrada/comun";

export function EntradaInicio({ puedeCobrar, puedeAlta, pase, ultima, chico = false }: {
  puedeCobrar: boolean; puedeAlta: boolean; pase: boolean; ultima: string | null; chico?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const router = useRouter();
  const ver = () => {
    const t = texto.trim();
    if (document.documentElement.dataset.entradaLista === "si") {
      window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_ENTRADA_CON, { detail: t }));
      setTexto("");
    } else router.push(t ? `/panel/entrada?q=${encodeURIComponent(t)}` : "/panel/entrada");
  };
  return (
    <div className="entrada-inicio" data-entrada-inicio>
      {!chico && <h2 className="titulo entrada-inicio-titulo">Entrada</h2>}
      <form className="entrada-inicio-campo" onSubmit={(e) => { e.preventDefault(); ver(); }} role="search">
        <span aria-hidden className="entrada-inicio-lupa"><Icono nombre="buscar" linea /></span>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={chico ? "DNI o QR" : "Tipeá el DNI o escaneá el QR"}
          aria-label="DNI o QR del socio" autoComplete="off" inputMode="text" data-entrada-inicio-campo />
        <button type="submit" className="entrada-inicio-ver">{chico ? "Ver" : "Ver si pasa"}</button>
      </form>
      {(puedeCobrar || puedeAlta) && (
        <nav className="entrada-inicio-acciones" aria-label="Acciones del mostrador" data-acciones-mostrador>
          {puedeCobrar && <Link href="/panel/vender" className="boton boton-claro" data-accion-rapida="cobrar"><Icono nombre="plata" linea />{" "}Cobrar</Link>}
          {puedeAlta && <Link href="/panel/socios/nuevo" className="boton" data-accion-rapida="alta"><Icono nombre="mas" linea />{" "}{chico ? "Alta" : "Alta de socio"}</Link>}
          {puedeCobrar && pase && <Link href="/panel/vender" className="boton" data-accion-rapida="pase"><Icono nombre="ticket" linea />{" "}{chico ? "Pase" : "Pase diario"}</Link>}
        </nav>
      )}
      {!chico && <p className="texto-suave entrada-inicio-pie">{ultima ? `Última entrada: ${ultima} · ` : ""}F2 vuelve acá desde cualquier pantalla</p>}
    </div>
  );
}
