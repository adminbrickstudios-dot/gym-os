# Diseño de Base

Reemplaza, donde choquen, a `docs/DISENO.md` y a `docs/v2/07-DISENO-VELOCIDAD-NAVEGACION.md`
(fondo oscuro "modo gym", emojis como íconos, esquinas de 16 px). Lo demás de
esos archivos (movimiento, esqueletos, memoria, botones de volver) sigue
valiendo.

La idea: **un mostrador de gimnasio, no una app de IA**. Claro, encuadrado,
números grandes que se leen de lejos, el color del gimnasio en un solo lugar, y
los cuatro colores del semáforo siempre iguales.

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

Sin mayúsculas sostenidas en etiquetas. Sin texto con letras separadas.

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

### El aviso flotante (BASE-3)

- 360 px de ancho, abajo a la derecha, encima de todo. En celular, abajo a lo
  ancho.
- Franja de color de 6 px a la izquierda con el color del semáforo.
- Primera línea: nombre (22 px, condensada). Segunda: lo que importa según el
  color (plan y días · motivo del rechazo · "vence el jueves" · "prueba hasta el
  12/11").
- Se apilan hasta 3; el más nuevo abajo. El cuarto empuja al más viejo.
- Se esconde solo: verde a los 5 s, amarillo y azul a los 8 s, rojo a los 12 s.
  Con el mouse o el dedo encima, no se esconde.
- Tocarlo abre el panel lateral. Tiene X.
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

- Nombre visible: **Base**. Donde hoy dice "Gym OS" en algo que ve la gente
  (ingreso, página de venta, super admin, mails, títulos, `manifest`, imagen
  OG, pie "hecho con"), pasa a "Base".
- El panel de cada gimnasio muestra la marca del gimnasio, no la de Base. Base
  aparece solo en el pie y en lo de la plataforma.
- El repo, el código, las tablas, las variables y los nombres de archivo no
  cambian.
