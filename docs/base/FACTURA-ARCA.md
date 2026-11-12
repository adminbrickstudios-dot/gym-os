# Factura electrónica ARCA (N7) · diseño corto

Estado: ⛔ **no construido** (necesita decisiones de Mateo y de contabilidad) y 🔌 (necesita servicio contratado y certificados del gimnasio). Toca plata y
obligaciones fiscales: nunca se arma solo (ver `PREGUNTAS.md`, P-N4).

## Qué sería

Una factura C (monotributo) por cada cobro, opcional por gimnasio, con el interruptor de N5 (`factura_arca`, apagado). El hecho ya está: cada `pagos` aprobado con su venta.
La factura es un hecho nuevo (`facturas`: gimnasio, venta, número, CAE, vencimiento del CAE, estado) que sale **después** del cobro; si falla, el cobro no se frena y queda
"factura pendiente" a reintentar.

## Dos caminos

- **A · Proveedor intermediario** (una API que habla con ARCA): el gimnasio contrata, nosotros mandamos el JSON y guardamos número y CAE. Menos trabajo, costo mensual, depende del tercero.
- **B · Servicio web de ARCA directo** (WSAA + WSFEv1): certificado y clave del gimnasio guardados cifrados (Vault), ticket de acceso por gimnasio. Sin intermediario, mucho más trabajo y mantenimiento.

Recomendado: A, detrás de una interfaz chica (`emitirFactura(venta)`) para poder cambiar de proveedor.

## Lo que hace falta antes de escribir código

1. ⛔ Elegir el camino y el proveedor (precio, soporte, sandbox de ARCA).
2. 🔌 Datos fiscales del gimnasio: CUIT, punto de venta, condición ante IVA (monotributo o responsable), certificado/credenciales.
3. ⛔ Qué se factura: ¿cuotas y productos?, ¿consumidor final sin datos?, ¿el socio puede pedir factura a su CUIT?, ¿y las devoluciones (nota de crédito)?
4. ⛔ Quién la emite y cuándo (al cobrar, al fin del día, a pedido).
5. Un gimnasio de ensayo con sandbox de ARCA; nunca facturar de verdad desde el demo ni desde pruebas.

## Qué se reutiliza

`ventas` / `pagos` (el hecho), `eventos_webhook` (idempotencia por ID externo), el interruptor por gimnasio (N5), `exportar_datos` para el contador mientras tanto.
