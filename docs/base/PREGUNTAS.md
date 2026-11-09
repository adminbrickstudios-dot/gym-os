# Preguntas para Mateo

El agente no frena por una pregunta: aplica la opción recomendada, la marca
**decidido por defecto** y sigue. Mateo contesta cuando puede; si elige otra
opción, se cambia en la vuelta siguiente.

Formato de cada pregunta nueva:

```
## P-<n> · <tema> (<fecha>)
<la pregunta, en una línea>
- A) … (recomendada: por qué)
- B) …
Decidido por defecto: A. Dónde se nota: <pantalla o ítem>.
Respuesta de Mateo: (vacío)
```

---

## Contestadas por Mateo (07/11)

| # | Pregunta | Respuesta |
|---|---|---|
| D36 | ¿Guardar la vigencia en el socio? | Guardar `cubierto_hasta` por trigger; el color se calcula comparando con hoy. |
| D37 | ¿Fondo claro u oscuro? | Claro por defecto, oscuro elegible. |
| D38 | ¿Emojis? | Íconos de línea propios. |
| D39 | ¿Se llama Base? | Sí. |

## Decididas por defecto (07/11, al armar `docs/base/`)

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D40 | El pedido pide aviso en la esquina + panel lateral; hoy está la ventana grande del veredicto (VD-1). | Aviso + panel en la recepción; la ventana grande queda como opción en Configuración. | Con 10 personas en la fila, un aviso que no tapa deja seguir tipeando; la ventana grande sirve para una tablet en la puerta. |
| D41 | ¿Pantallas nuevas en `/dueno`, `/recepcion`…? | Puertas fijas que llevan a lo que ya existe. | Duplicar pantallas duplica errores. |
| D42 | ¿Quién pone la contraseña del dueño y del equipo? | Quien crea la cuenta elige: la escribe o manda un link. | Mañana Mateo necesita darle la clave al dueño en el momento; el link sirve cuando haya SMTP. |
| D43 | ¿Cómo se entra? | Mail y contraseña adelante; Google y código abajo si están configurados. | Es lo que todos entienden y no depende de cuentas externas. |
| D44 | ¿Asistente nuevo o el de Primeros pasos? | El de Primeros pasos, con los 9 pasos del pedido. | Ya calcula qué está hecho (VD-43). |
| D45 | ¿Con cuántos datos se mide? | 5.000 socios, 100.000 ingresos. | Lo pide el pedido; hoy se midió con 3.000. |
| D46 | ¿`negocio_id` o `gimnasio_id`? | `gimnasio_id`. | Renombrar 215 migraciones no suma nada. |
| D47 | ¿Y si no se puede leer el repo de Sillón? | Se sigue la barra de yadeportes. | No frena nada. |
| D48 | ¿Dónde quedan los accesos? | `ACCESOS.md` local, en `.gitignore`. | El repo es público. |
| D49 | ¿Anti-robot sin cuenta externa? | Turnstile si está la variable, más campo trampa y tope por IP siempre. | Anda desde mañana sin configurar nada. |
| D50 | ¿Sonido? | Prendido, distinto para el rojo, se apaga desde la recepción. | En el mostrador no siempre se mira la pantalla. |
| D51 | ¿Planes pagos? | El agente escribe qué hace falta; no contrata. | Gastar plata es de Mateo. |
| D52 | ¿Ley 25.326? | Política, consentimiento y pedido de datos del socio; la inscripción en la AAIP la hace el gimnasio. | Es obligación del responsable de la base, que es el gimnasio. |

## Decididas por defecto en la revisión del 09/11

| # | Pregunta | Por defecto | Por qué |
|---|---|---|---|
| D53 | El segundo factor estaba pedido en cuatro lugares (VD-33D, VD-42B, VD-42C, SA-10) | Uno solo: SA-10. Obligatorio para el super admin; para el dueño, recomendado y que él lo prenda. | Un dueño que pierde el celular no puede quedar afuera de su gimnasio el primer día. |
| D54 | VD-40B repetía el super admin nuevo | Pasa a los SA-* de `SUPER-ADMIN.md`. | Una sola lista. |
| D55 | La demo que "se borra sola a los 7 días" chocaba con "nada depende de un cron" y con ADM-5 | La demo es un gimnasio `[demo]` aparte. A los 7 días queda vencida (se calcula) y se borra entera con un botón. | Borrar un gimnasio sin datos reales no rompe ninguna regla, y destraba ADM-5. |
| D56 | Los avisos de abajo a la derecha tapaban el botón de Entrada | Se apilan arriba del botón, o a la izquierda de la barra fija. | Nada tapa nada. |
| D57 | ¿El socio sube su foto desde la app? | Solo si el gimnasio lo prende (apagado por defecto). La recepción ve "foto nueva" hasta confirmarla. | Es la foto con la que lo reconocen en la puerta (anti-préstamo). |
| D58 | ¿Qué es lo principal del Inicio? | Recepción: el mostrador (búsqueda, números, lista en vivo). Dueño: números y Para hacer hoy. | Cada uno hace otra cosa en su primer minuto. |
| D59 | Reseñas en la página y "+N socios" contra "nada inventado" | Reseñas solo con nombre, fecha y link a la reseña de Google; sin link no se muestran. "+N socios" sale de la base y solo aparece con 20 o más. | Así nada de la página puede ser inventado. |
| D60 | Términos BRIK–gimnasio y contrato de encargado del tratamiento | El agente escribe un borrador, marcado "revisar con un abogado"; el dueño lo acepta al entrar y queda la fecha y la versión. | Sin texto no hay qué aceptar; la revisión legal es de Mateo. |

---

## Abiertas

### BASE-0 · vd-7 y vd-8 (averiguados el 08/11, base nueva y app compilada con Next 16.4.5)

- **vd-8 (PIN equivocado): no era un fallo de permisos.** El PIN equivocado no deja pasar y sí avisa
  ("PIN equivocado: te quedan N intentos"). La prueba miraba el primer `role="alert"` de la página, que es el
  anunciador de rutas de Next (vacío). Se corrigió la prueba: pasa 15 de 15. **Nada que decidir.**
- **vd-7 (simulación vs. hoja Cobrar): no hay diferencia de plata.** La simulación mostraba "Paga la cuota entera" porque
  la prueba la corría ANTES de pasar los planes a la regla del gimnasio, y `simular_cuota` usa la regla de ese plan
  (que era "continua"): correcto. Además la prueba pedía fechas de dos dígitos ("8/11"). Se reordenó la prueba y se acepta
  una cifra. **Nada que decidir**; la cuenta de la base no se tocó.
- Decidido por defecto: lo que dice la hoja Cobrar y lo que dice la simulación vienen de la misma regla; no se cambió ninguna función.
- vd-41: la sección Gastos, apagada para el encargado sin permiso, decía "sección apagada por el gimnasio". Ahora dice
  "No tenés permiso para ver los gastos" (solo cambia el texto, quién ve qué no cambió).

### Carril B · Super admin (09/11, ayudante 1)

- **SA-4 plata como soporte: NO está aplicada.** Pide que, entrando como soporte, cobrar/anular/tocar la caja no se
  permita salvo "lo pidió el dueño" en el motivo. Eso cambia quién puede cobrar en `vender`, `anular_*` y la caja
  (permisos y plata), así que no lo toqué. Hoy el soporte entra con el rol elegido (dueño, recepción o profe) y puede
  lo que ese rol. Recomendado: una sola función `privado.exigir_equipo` que mire `soportes_gimnasio` y rechace
  esas acciones si el motivo no dice "lo pidió el dueño". Lo hace el principal.
- **SA-5 buscar a cualquiera:** devuelve nombre, gimnasio y rol (nunca DNI, mail ni teléfono), pide motivo y deja
  registro en `registro_brik` con lo buscado y cuántos encontró, no con el resultado. Busca socios por mail exacto,
  DNI exacto o teléfono (últimos dígitos) y al equipo por mail exacto. Decidido: coincidencia exacta, para que nadie
  explore la base de a letras.
- **Registro de BRIK (`registro_brik`):** tabla nueva sin `gimnasio_id` obligatorio (la búsqueda no tiene gimnasio).
  La sumé a la lista de excepciones de `scripts/chequeos.mjs` (junto con `favoritos_brik`): el principal debe confirmarlo.
- **Bug de base encontrado:** `privado.hecho_inmutable()` sin argumentos NO frena los UPDATE (con la lista de columnas
  permitidas vacía, la comparación da NULL). Por eso `registro_brik` lo usa con un argumento que no es columna. Otras
  tablas que lo usen sin argumentos podrían dejarse editar: conviene revisarlo (permisos, no lo arreglé).
- **Ciudad del gimnasio:** no existe la columna, así que la lista no filtra ni muestra ciudad. Recomendado: agregarla a
  `configuracion_gimnasio` cuando el dueño la cargue en el asistente.
- **Errores de las últimas 24 h (tablero y ficha):** no hay tabla de errores de la app, solo `ultimo_error` en las ayudas.
  Quedó sin hacer hasta decidir dónde se guardan (recomendado: `errores_app` alimentada desde `error.tsx`).
- **Reprocesar webhook:** la ficha lista los fallidos pero no los reprocesa: eso toca la ruta del webhook de MercadoPago
  (plata). Recomendado: función que vuelva a correr el mismo handler idempotente por `id_externo`.
- **Cambiar quién es el dueño:** el anterior queda como encargado (no pierde el acceso). Decidido por defecto.
