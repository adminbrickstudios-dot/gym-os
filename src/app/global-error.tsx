"use client";
import "./globals.css";

/**
 * Vuelta final (22/11) · el último error posible: cuando falla el layout raíz (por ejemplo, la base no contesta justo al armar la
 * página). Sin esto, Next muestra su pantalla genérica en inglés y sin salida. Acá: qué pasó en palabras, Probar de nuevo e Ir al
 * inicio. No usa la marca del gimnasio porque el layout que la trae es justamente lo que falló.
 */
export default function ErrorRaiz({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh grid place-items-center px-4" style={{ background: "var(--fondo)", color: "var(--texto)" }}>
        <main className="max-w-md text-center" data-error-raiz>
          <h1 className="titular text-4xl sm:text-5xl">No se pudo abrir la página</h1>
          <p className="texto-suave text-lg mt-4">
            Puede ser la conexión o el sistema, que no contestó a tiempo. Si estás en la puerta, no dejes pasar a nadie por esta pantalla:
            probá de nuevo en unos segundos o usá la entrada sin internet.
          </p>
          {error?.digest && <p className="texto-tenue text-sm mt-3">Código del error: {error.digest}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="boton boton-principal text-lg px-8">Probar de nuevo</button>
            {/* Recarga entera a propósito: lo que falló es el layout, una navegación del cliente lo reusaría. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="boton text-lg px-8">Ir al inicio</a>
          </div>
        </main>
      </body>
    </html>
  );
}
