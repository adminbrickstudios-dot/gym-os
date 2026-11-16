# Diseño de Base

Reemplaza, donde choquen, a `docs/DISENO.md` y a `docs/v2/07-DISENO-VELOCIDAD-NAVEGACION.md`
(fondo oscuro "modo gym", emojis como íconos, esquinas de 16 px). Lo demás de
esos archivos (movimiento, esqueletos, memoria, botones de volver) sigue
valiendo.

La idea: **un mostrador de gimnasio, no una app de IA**. Claro, encuadrado,
números grandes que se leen de lejos, el color del gimnasio en un solo lugar, y
los cuatro colores del semáforo siempre iguales.

## Pase 2.0 · El rediseño "Pista" (en diseño con Mateo, NO se programa todavía)

> Hasta que Mateo apruebe los diseños del lienzo "Pase 2.0 · Estilos" (claude.ai), todo lo de abajo de esta sección sigue
> mandando. Esta sección es el registro de lo que Mateo va decidiendo; el agente no la implementa hasta que una línea diga
> "aprobado para programar".

**Decidido por Mateo (16/11):**
- Estilo **A · Pista**: oscuro y deportivo, títulos grandes condensados (Big Shoulders Display) y texto en Inter, un acento
  fuerte (naranja por defecto). Se edita con lo que Mateo vaya pasando; Claude recomienda.
- Orden de Pase 2.0, el de Mateo: visual → estructura → detalles → funciones → agregados → seguridad. Después, la
  profesionalización (cuando diga "terminado oficialmente").
- Primero diseños (el lienzo), después código.
- **Cambia cómo se ve y se mueven algunas cosas de lugar. Nada más: ninguna función se pierde.**
- **Los colores se pueden cambiar** (por gimnasio).
- Botones más lindos, algún que otro emoji, más organizado visualmente.
- La página de cada gimnasio también se rediseña: diseño, dibujos, estilo y botones.

**Decidido por Mateo (16/11, segunda tanda):**
- **Claro y oscuro:** el mismo diseño Pista en las dos versiones, oscuro por defecto. Cada gimnasio (y cada compu) elige.
  Reemplaza a "claro por defecto" de más abajo cuando Pista se apruebe.
- **Colores del gimnasio:** su color principal (de una paleta probada, o uno propio que el sistema corrige si no se lee o si se
  parece al semáforo) y claro u oscuro. Nada más: la paleta completa no se abre.
- **Emojis en pocos lugares:** en los accesos rápidos, los avisos y las pantallas vacías. El menú y los botones de acción
  siguen con íconos de línea (D38). Mateo sabe que en Windows los emojis se ven distintos.
- **Página del gimnasio:** dibujos propios de Pase (pesas, bici, gente entrenando) en el color del gimnasio, más sus fotos cuando
  las sube. Nunca queda vacía.

**Para no olvidar en el rediseño (recomendado por Claude, 16/11):**
- Todo lo que ve el socio, no solo el panel: la tablet, la TV, la app, el cartel del QR, los recibos, la imagen al compartir
  el link, el ícono de la app.
- Las pantallas que nadie diseña: cargando, vacía, error y sin internet.
- El panel del dueño en el celular.
- Un Inicio por rol (recepción, dueño, profe), con lo suyo arriba.
- Entrada y Cobrar siempre en el mismo lugar, y "Novedades" para avisarle al equipo de Benja qué cambió.
- El semáforo no lo cambia nadie.
- El logo de Pase.

**Cómo se programa, cuando se apruebe (para que no se rompa ni se pierda nada):**
1. **Inventario antes:** por cada pantalla, cada botón, sección, número y acción que tiene hoy (sale de `src/lib/panel/secciones.ts`,
   de cada `page.tsx` y de los `data-*` que usan los e2e). Una prueba nueva recorre el inventario en el estilo nuevo: si falta
   algo, no se publica.
2. **Solo el aspecto:** tokens, componentes y lugar en la pantalla. Ni lógica, ni base, ni plata en la fase visual.
3. **Detrás de una llave por gimnasio** ("estilo Pista"): prendido en los `[demo]`; a Temple Gym lo prende Mateo cuando lo
   aprueba, y se vuelve al de antes con un toque.
4. **Las 250 pruebas e2e pasan sin cambios** (usan `data-*`, no estilos), más capturas antes y después de cada pantalla en compu y
   celular, y comparación de capturas para que nada se mueva sin querer.
5. Publicación fuera de 16–22 h, como siempre.

## Tokens (todo sale de acá: ningún color suelto en el código)

### Claro (por defecto)

| Token | Valor | Para qué |
|---|---|---|
| `--fondo` | `#F4F5F6` | Fondo de la pantalla (gris muy claro, frío; no crema) |
| `--superficie` | `#FFFFFF` | Tarjetas, panel lateral, avisos |
| `--borde` | `#E2E4E8` | Separadores y bordes de 1 px |
| `--texto` | `#15171A` | Texto principal |
| `--texto-2` | `#5B616B` | Etiquetas y texto secundario |
| `--acento` | color del gimnasio | La acción principal, el ítem activo del menú, los íconos activos |
| `--sobre-acento` | blanco o negro según el contraste del color del gimnasio | Texto encima del acento |

### Oscuro (elegible)

| Token | Valor |
|---|---|
| `--fondo` | `#111315` |
| `--superficie` | `#1A1D20` |
| `--borde` | `#2B2F34` |
| `--texto` | `#F2F3F5` |
| `--texto-2` | `#A2A8B1` |

### Semáforo (fijo, igual en claro y oscuro, nunca lo cambia el gimnasio)

| Token | Valor | Significa |
|---|---|---|
| `--ok` | `#1E9E5A` | Puede pasar |
| `--no` | `#D6383A` | No puede pasar |
| `--atencion` | `#D88A0B` | Por vencer (3 días o menos) o algo para mirar |
| `--prueba` | `#2D6FD8` | En prueba |

Cada uno con su versión suave para fondos (`--ok-suave`, etc.), calculada con
`color-mix`. Si el color del gimnasio es muy parecido a uno del semáforo, el
acento se corre un poco de tono: el semáforo tiene que distinguirse siempre.

El gimnasio elige claro u oscuro en Configuración → Marca; cada usuario puede
cambiarlo en Mi cuenta (D37). Se guarda en la base, no en el navegador.

## Tipografía

- **Títulos y números:** Barlow Condensed, 600 y 700. Siempre con
  `font-variant-numeric: tabular-nums` en números, para que no bailen.
- **Texto:** Barlow, 400 y 500.
- Con `next/font` (sin pedidos a Google en cada carga).

Escala: número grande de Inicio 44 px · título de pantalla 28 px · nombre en el
aviso 22 px · texto 15 px · etiqueta 13 px. La jerarquía se hace con el tamaño
y el peso, no con cajas.

Sin mayúsculas sostenidas en etiquetas ni texto con letras separadas. La única
excepción son los títulos de grupo del menú lateral (HOY, SOCIOS, PLATA,
GIMNASIO): van en mayúsculas chicas y en gris, como pidió Mateo.

## Forma

- Esquinas: 10 px en tarjetas, 8 px en botones y campos. Nada de 16 px o más.
- Sombra: ninguna en lo que está quieto. Una sola sombra suave para lo que flota
  (avisos, panel lateral, menú abierto).
- Bordes de 1 px con `--borde` para separar; nada de cajas dentro de cajas.
- Alto mínimo de lo que se toca: 48 px (recepción y celular).

## Íconos (D38)

- Un set de línea (`lucide-react`), trazo 1,75, 20 px, `currentColor`.
- Un solo componente `Icono` con los nombres que usa Base (`entrada`, `socios`,
  `caja`, `clases`, …), para cambiar el set en un solo lugar.
- Inactivo: `--texto-2`. Activo o principal: `--acento`. En el semáforo: el
  color del estado.
- **Ningún emoji como ícono**, en ningún panel, app ni página. (Un emoji que el
  dueño escribe en un texto suyo es de él y se respeta.)

## Textos (que no parezcan hechos por una IA)

- Valen para todo lo que se lee: paneles, app, página del gimnasio, página de
  venta de Base, super admin, mensajes de WhatsApp armados y mails.
- Voz concreta y corta, en español rioplatense neutro. Cada texto dice algo que
  se puede comprobar: "Te quedan 12 días", no "Disfrutá tu experiencia".
- Nada de frases de IA: "experiencia única", "llevá tu gimnasio al siguiente
  nivel", "sin complicaciones", "potenciá", "solución integral".
- Los paneles son sobrios y densos donde se trabaja (recepción, caja, socios), y
  más aireados donde se lee (la página del gimnasio, la app del socio).
- En la fase de fluidez se revisan **todos** los textos visibles con esta regla.

## Lo prohibido

- Degradados violeta o azul, y degradados de decoración en general.
- Emojis como decoración o como ícono.
- Grillas de tarjetas iguales "ícono + título + texto".
- Frases vacías ("Potenciá tu gimnasio", "La solución integral").
- Testimonios, números o logos de clientes inventados.
- Fotos de banco. Si el gimnasio no subió foto, la portada usa su color y su
  nombre, no una foto ajena.
- Sombras exageradas, esquinas muy redondas, vidrio con degradado.

## Navegación

Como la de Sillón y la de yadeportes (D47): barra lateral con el buscador
(Ctrl+K) arriba, Inicio destacado y **cuatro secciones principales**, cada una
con una línea que explica qué es. El resto, adentro de cada sección o en
"Más". La propuesta, que el agente ajusta al menú de hoy (VD-11) sin perder
ninguna pantalla:

```
Buscar…                       Ctrl K
Inicio

HOY        Entrada, vencen hoy, para hacer hoy
SOCIOS     Socios, interesados, retención, mensajes
PLATA      Cobrar, caja, ventas, gastos, resultado
GIMNASIO   Clases, rutinas, equipo, página, configuración
```

En celular: barra de abajo con las mismas cuatro más Inicio.
Lo que el rol no puede usar no aparece. Lo que el gimnasio apagó tampoco.

## Recepción: el mostrador

Pensada para la compu del mostrador con teclado; tiene que andar igual en tablet
y en celular.

```
┌──────────────────────────────────────────────────────────────────┐
│  [ DNI, nombre, teléfono o pasá el QR…                    F2 ]   │  ← barra gigante, siempre arriba
├──────────────────────────────────────────────────────────────────┤
│  Adentro 23 │ Entraron hoy 141 │ Vencen hoy 6 │ Deben 18 │ Caja $  │  ← franja fija de números
├────────────────────────────────────────┬─────────────────────────┤
│  Últimos ingresos (en vivo)            │  Cobrar  Alta  Pase día │
│  19:42  ● Lucía Pérez   Mensual  12 d  │                         │
│  19:41  ● Juan Gómez    Debe desde 3/11│                         │
│  …                                     │                         │
│                                        │      ┌─────────────────┐│
│                                        │      │▌Lucía Pérez     ││ ← avisos abajo a la derecha
│                                        │      │▌Mensual · 12 días││
│                                        │      └─────────────────┘│
└────────────────────────────────────────┴─────────────────────────┘
```

### Qué es lo principal de cada Inicio (D58)

- **Recepción:** el mostrador de arriba. Primero la barra de búsqueda, después
  la franja de números y la lista en vivo. Para hacer hoy va al costado.
- **Dueño:** el saludo, los accesos rápidos, los números y **Para hacer hoy**
  como bloque principal (VD-13D). La lista en vivo va debajo.

### El aviso flotante (BASE-3)

Abajo a la derecha, **sin tapar nunca** el botón de Entrada ni la barra fija
(D56):
- Si está el botón flotante de Entrada, los avisos se apilan arriba de él.
- Si está la barra fija a la derecha, los avisos van a la izquierda de la
  barra.
- En la recepción con el mostrador, la búsqueda está arriba y la esquina queda
  libre.


- 360 px de ancho, abajo a la derecha, encima de todo. En celular, abajo a lo
  ancho.
- Franja de color de 6 px a la izquierda con el color del semáforo.
- Primera línea: nombre (22 px, condensada). Segunda: lo que importa según el
  color (plan y días · motivo del rechazo · "vence el jueves" · "prueba hasta el
  12/11").
- Se apilan hasta 3; el más nuevo abajo. El cuarto empuja al más viejo.
- Se esconde solo: verde, amarillo y azul 1,5 s grandes y 8 s en pastilla; **el rojo no se achica: queda hasta que alguien lo atienda o lo cierre (tope de 10 min)** (D71, NOCHE-1211 E2; esto reemplaza lo que decía 5, 8 y 12 s).
  Con el mouse o el dedo encima, no se esconde.
- Tocarlo lo fija y abre el panel lateral con la ficha rápida y la foto (D72). Tiene X.
- Entra deslizando 160 ms; con `prefers-reduced-motion`, aparece sin moverse.

### El panel lateral

- 440 px desde la derecha; en celular, pantalla completa que sube desde abajo.
- Arriba, fijo: foto, nombre, DNI y el estado con su color.
- Vigencia con barra (desde/hasta, meses y días que le quedan).
- Si no puede pasar: cuánto debe y desde cuándo, y **COBRAR AHORA** con el
  monto sugerido, ancho, en `--acento`. Debajo, "Dejar pasar igual" (pide motivo).
- Después: último pago, próximo pago, historial de pagos, últimos ingresos,
  notas, WhatsApp.
- Esc, la X y el click afuera lo cierran. Nunca se abre un panel encima de
  otro: el nuevo reemplaza al anterior.

## Modales (todos)

X visible arriba a la derecha; Esc y click afuera cierran (salvo que haya algo
escrito sin guardar: ahí pregunta una vez). Nunca dos modales apilados. Nunca
quedan trabados en "Guardando…": si la acción falla o tarda más de 10 s, se ve
el error y se puede reintentar.

## Página del gimnasio

La foto real del gimnasio manda. Portada: foto, nombre, dirección y los dos
botones ("Soy socio", "Quiero ser socio"). Planes en tarjetas simples (nombre,
precio, qué incluye, un botón). Clases de la semana en grilla. Horarios, mapa,
WhatsApp. El color del gimnasio solo en los botones.

## La marca Base (D39)

- Nombre visible: **Pase** (D69; antes Base, D39). Donde hoy dice "Gym OS" en algo que ve la gente
  (ingreso, página de venta, super admin, mails, títulos, `manifest`, imagen
  OG, pie "hecho con"), pasa a "Base".
- El panel de cada gimnasio muestra la marca del gimnasio, no la de Base. Base
  aparece solo en el pie y en lo de la plataforma.
- El repo, el código, las tablas, las variables y los nombres de archivo no
  cambian.
