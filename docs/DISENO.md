# Sistema visual — cómo se arma cada pantalla

Las reglas de fondo están en `docs/producto/02-DISENO.md`. Acá está **con qué
se construye**: las clases de `src/app/globals.css` y los componentes de
`src/components/ui/` y `src/components/panel/`. **Ninguna pantalla define un
botón, una tarjeta, un mensaje o un estado vacío a mano**: si falta algo, se
suma acá y se usa en todos lados.

## Colores y medidas

Todo sale de `--fondo` y `--acento` (datos del gimnasio, `propsMarca()`).
Superficies: `--tarjeta`, `--tarjeta-alta`, `--borde`. Texto: `--texto`,
`--texto-suave`, `--texto-tenue`. Estados: `--verde`, `--amarillo`, `--rojo`,
`--azul`, `--naranja`. Radio `--radio` (16 px), `--radio-grande` (24 px). Alto
mínimo de todo lo que se toca: `--alto-minimo` (52 px); los chicos, 44 px.

## Texto

| Clase | Para qué |
|---|---|
| `.titular` | Título de pantalla (`text-5xl sm:text-6xl`) |
| `.titulo` | Títulos de tarjeta y sección |
| `.numero` | Números y precios (cifras tabulares) |
| `.texto-suave` / `.texto-tenue` | Bajadas y datos secundarios |
| `.etiqueta` | Etiqueta de un campo |
| `.titulo-grupo` | Título de grupo (menú, secciones de una pantalla) |

## Botones

| Clase | Cuándo |
|---|---|
| `.boton` | Cualquier acción |
| `.boton .boton-principal` | La acción principal de la pantalla. **Una sola por pantalla** |
| `.boton .boton-peligro` | Borrar, dar de baja, anular |
| `.boton .boton-chico` | Acción secundaria dentro de una fila |
| `.boton-texto` | Acciones discretas: Salir, Cancelar, Descuento, Ocultar |

Siempre con emoji delante cuando es una acción de las de todos los días
("🛒 Vender", "🔑 Nueva contraseña"). Mientras trabaja, el texto cambia
("Cobrando…") y el botón queda `disabled`.

## Componentes

| Componente | Archivo | Uso |
|---|---|---|
| `Encabezado` | `panel/Marco.tsx` | Arriba de cada pantalla: emoji, título, una línea de qué es, acción opcional |
| `Aviso` | `panel/Marco.tsx` | Pantalla completa de error o sin permiso (con `intentar()`) |
| `Mensaje` | `ui/Mensaje.tsx` | Resultado de una acción o error: `tipo="error" \| "exito" \| "aviso" \| "info"`, `accion` opcional |
| `Vacio` | `ui/Vacio.tsx` | Lista o pantalla sin nada: emoji, título, qué va a aparecer, `acciones` |
| `Dato` | `ui/Dato.tsx` | Número grande con etiqueta; con `href` lleva al detalle |
| `Interruptor` | `ui/Interruptor.tsx` | Prender / apagar algo, con su línea de ayuda |
| `Pestanas` | `ui/Pestanas.tsx` | Pestañas; con `href` cada una es una ruta |
| `PildoraEstado` / `PuntoEstado` | `panel/Estado.tsx` | El semáforo, siempre con su texto |
| `GrillaAccesos` | `panel/GrillaAccesos.tsx` | Los botones grandes de Inicio, editables |
| `Buscador` | `panel/Buscador.tsx` | Ctrl+K |

## Clases de estructura

| Clase | Uso |
|---|---|
| `.tarjeta` | Superficie con borde y radio |
| `.fila` | Fila de lista que se toca entera (buscar y elegir) |
| `.campo` | Inputs, selects y textareas |
| `.interruptor` | El checkbox con forma de switch (lo usa `Interruptor`) |
| `.pestanas` / `.pestana` | Lo usan `Pestanas` |
| `.pildora` + `.pildora-<color>` | Estados chicos |
| `.mensaje` + `.mensaje-<tipo>` | Lo usa `Mensaje` |
| `.vacio` | Lo usa `Vacio` |
| `.icono` | Emoji en su cuadrado |
| `.animar-subir` | Entrada suave de algo nuevo (180–200 ms) |

## Animaciones

- Tocar: `:active` en CSS (achica y oscurece), nunca JS.
- Algo que aparece (mensajes, resultados): `subir` (ya incluida en `.mensaje`).
- Tilde de "listo": keyframe `tilde` sobre un `stroke-dasharray: 24` (para el cobro, ENT-1/VEN).
- `prefers-reduced-motion` apaga todo (regla global).

## Cómo se arma una pantalla del panel

```tsx
export default async function Pantalla() {
  return intentar(async () => {
    const ctx = await contextoPanel();
    const datos = await rpc<...>("funcion_de_la_base", { p_gimnasio_id: ctx.panel.gimnasio_id });
    return (
      <>
        <Encabezado emoji="🧾" titulo="Transferencias" bajada="Qué es esta pantalla, en una línea." />
        {datos.length === 0
          ? <Vacio emoji="✨" titulo="Nada para revisar">Qué va a aparecer acá y cuándo.</Vacio>
          : <ul className="space-y-2">…</ul>}
      </>
    );
  });
}
```

Y su `loading.tsx` con la misma forma (encabezado y filas grises), nunca un spinner solo.
