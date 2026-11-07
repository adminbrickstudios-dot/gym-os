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

---

## Abiertas

(El agente agrega acá.)
