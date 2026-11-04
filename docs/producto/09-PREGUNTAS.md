# Preguntas para Mateo

El agente usa la opción **por defecto** hasta que Mateo conteste. Cuando
conteste, se anota la respuesta acá y se ajusta lo hecho.

| # | Pregunta | Por defecto (lo que hace el agente) | Respuesta de Mateo |
|---|---|---|---|
| P1 | ¿Cómo entra el socio a la app? | Código por **mail** (Resend, gratis hasta 3.000/mes) y opción de crear contraseña. El código por SMS queda armado pero apagado (cada SMS se paga) | |
| P2 | Pagos online: ¿BRIK crea una app de MercadoPago (los gimnasios conectan su cuenta con un botón) o cada gimnasio pega su clave? | Botón "Conectar MercadoPago" (OAuth) usando la app de BRIK; mientras Mateo no cree la app, todo se prueba con eventos simulados firmados | |
| P3 | ¿Tus primeros clientes necesitan factura electrónica (ARCA)? | No para el MVP: comprobante interno. Factura después, con un integrador | |
| P4 | Precio de Gym OS | Lo carga Mateo en el super admin; el sistema no inventa precios | |
| P5 | Nombre y dominio | "Gym OS" y el dominio que compre Mateo (cambia dos variables en Vercel) | |
| P6 | ¿Pasás capturas de yadeportes y Santa María? | Se sigue con el diseño actual; cuando lleguen, se guardan en `docs/producto/referencias/` y se ajusta | |
| P7 | ¿Cobrás vos (BRIK) la suscripción con MercadoPago? | El super admin registra pagos de cada gimnasio a mano y avisa vencimientos (ADM-3); cobro automático después | |
