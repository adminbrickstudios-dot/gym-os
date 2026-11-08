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
