# Lo que se va a romper si no lo prevenimos (12/11)

Temple Gym ya cobra con Base. Esto es lo que puede romperse en las próximas
semanas, qué se hace ya y qué depende de Mateo. Lo que hace el agente está como
ítem en `RECTA-FINAL.md` (fase D y reglas de `PROMPT.md`).

| Riesgo | Qué pasa | Qué se hace | Quién |
|---|---|---|---|
| Sin copias | Supabase Free no guarda copias. Un error en una migración o un borrado no tienen vuelta | Crear `COPIA_CLAVE` (H5) y pasar a Supabase Pro | Mateo |
| Publicar en hora pico | Un deploy a las 19 h, con 40 personas en la fila, puede dejar la recepción sin sistema unos minutos | **No publicar entre las 16 y las 22 h** (hora del gimnasio), salvo un arreglo urgente de algo roto | Agente (regla) |
| Migración que traba una tabla | Un índice o una columna sobre una tabla grande (ingresos) puede bloquear la entrada mientras corre | `create index concurrently` donde se pueda, y publicar fuera de hora pico | Agente |
| Límites del plan gratis | Base de 500 MB y Storage de 1 GB en Supabase Free: las fotos de socios y comprobantes lo llenan | Medir el tamaño cada día en `/super` (F9.6) y avisar al 70 % | Agente / Mateo (Pro) |
| Vercel Hobby | No permite uso comercial, y tiene límites de funciones | Pasar a Pro antes de cobrar el abono a Temple Gym | Mateo |
| Clave filtrada | El repo es público: una clave de servicio subida por error da acceso a todo | Chequeo que falla si aparece una clave en el código (SEG-02), y rotar las claves si alguna vez se subió | Agente / Mateo |
| Límites de Auth | Muchas altas seguidas por el QR (por ejemplo, el día que se pega el cartel) pueden chocar con el tope de Supabase Auth | Revisar los topes en Supabase → Auth → Rate limits y subirlos para las altas | Mateo (panel) / Agente (pasos) |
| QR impresos | Si cambia una dirección, el cartel pegado en la puerta deja de andar | Las direcciones viejas (`/g/<slug>/…`) redirigen para siempre, con una prueba que lo verifica | Agente |
| Medianoche y zona horaria | Cajas, vencimientos y "hoy" calculados en otra zona dan días corridos | Todo en la hora del gimnasio, con pruebas a las 23:59 y a las 00:01 | Agente |
| Datos de Temple Gym mal importados | Duplicados por DNI o pagos mal fechados arruinan "quién debe" | Importar siempre con vista previa, y un chequeo de DNIs repetidos en `/super` | Agente |
| Pagos reales de MercadoPago | Un webhook que falla o se repite cobra mal o no acredita | Idempotencia por ID (ya está), alerta de webhooks fallidos y "Reprocesar" (SA-3) | Agente |
| Una sola compu y un solo agente | Si la compu se apaga o el agente llega al límite, nadie trabaja | `hasta-terminar.sh`, 2 ayudantes como máximo, y la compu sin suspenderse | Mateo |
| Errores que nadie ve | El cliente se entera antes que BRIK | Registro de errores en `/super` con aviso, y Sentry (plan gratis) | Agente / Mateo (cuenta) |
| Precios que cambian | Con inflación, el dueño sube precios seguido y los socios se enojan si no se avisa | Aumentos con aviso previo (ya está, VD-46D) | — |
| Legal | Términos BRIK–gimnasio, privacidad (Ley 25.326) y facturación | Borradores (FA-19), "revisar con un abogado", y ARCA cuando haya servicio | Mateo |
