# 15 · Recomendaciones para Mateo (lo que se puede estar escapando)

Escrito como si fuera un socio de BRIK que mira el negocio de afuera.

## Sobre mañana (presentarle al dueño)

1. **No presentes lo que se hizo anoche sin mirarlo.** El agente publica
   por bloque solo con todo en verde (D25), pero a la mañana abrí el panel
   con el demo y recorré: Entrada, Cobrar, Inicio, la app del socio. Si algo
   no te convence, presentá con lo que sí.
2. **Presentá con un guion de 10 minutos**, no recorriendo todo:
   (1) llega un socio y pone el DNI, (2) uno vencido paga en 3 teclas,
   (3) uno nuevo se da de alta en el mostrador, (4) el dueño ve en el
   celular cuánto entró hoy y a quién cobrar, (5) el socio ve su app y su
   QR. Lo demás, "y además tiene…".
3. **Cargale sus datos antes** (logo, colores, planes reales, 5 socios de
   ejemplo con nombres reales del gimnasio si te los pasa): un dueño se
   enamora de ver SU gimnasio, no "Gimnasio Demo".
4. Llevá el teclado numérico USB y probalo en su compu.

## Producto

5. **Menos es más para el dueño.** Hay muchísimas funciones. Que vengan
   **apagadas por defecto** las que no todos usan (grados, TV, eventos,
   cupones, documentos, lugares en la sala) y prendidas en un toque desde
   Configuración → Secciones. Un panel con 19 secciones asusta.
6. En gimnasio no hay "estilistas": son **profes / entrenadores** y la
   **recepción**. Ya existe "Equipo" con roles; lo que se suma es
   foto, horario de cada uno y qué clases da.
7. **Plata real del gimnasio**: hoy Resultado muestra lo cobrado. Falta
   **Gastos** (alquiler, sueldos, luz, mantenimiento, proveedores) para ver
   la **ganancia** del mes y un **presupuesto** (cuánto espera gastar e
   ingresar). Es lo que un dueño mira primero después de "cuánto entró".
   → VD-41.
8. **Factura electrónica (ARCA)**: muchos dueños la van a pedir. Está en la
   COLA como 🔌 (COM-16). Conviene integrarlo con un proveedor (ej:
   Facturante, TusFacturas) antes que hablar directo con ARCA.
9. **Débito automático** (MercadoPago, MP-3) es lo que más baja la morosidad.
   Prioridad alta cuando el primer gimnasio esté andando.
10. **WhatsApp**: hoy los avisos se mandan a mano (gratis). El día que un
    gimnasio grande lo pida, WhatsApp oficial (AVI-3) cobra por mensaje:
    pasarlo al precio del plan.

## Negocio de BRIK

11. **Precio por tamaño** (por cantidad de socios activos) y **por sede**;
    el super admin ya tiene abonos. Definí 3 planes y cargalos (D13).
12. **Contrato y términos** con cada gimnasio: datos personales de sus
    socios (Ley 25.326, BRIK es "encargado del tratamiento"), qué pasa si no
    paga (D11), exporte de datos si se va.
13. **Dominio propio** de Gym OS (vas a comprar uno): con comodín
    (`*.tudominio.com`) cada gimnasio tiene su subdominio. Comprarlo en
    Vercel lo resuelve solo.
14. **Supabase Pro** (backups diarios) cuando el primer gimnasio pague.
    Vercel y Supabase en la **misma región** (São Paulo).
15. **Soporte**: un WhatsApp de BRIK visible en el panel ("¿Necesitás
    ayuda?") y la sección de Novedades (ya existe) para avisar cambios.

## Forma de trabajo

16. Una noche no alcanza para todo lo que está en `08-PLAN.md`. El orden de
    la noche pone primero lo que se ve mañana (tanda 1). Lo demás sigue las
    noches siguientes con el mismo prompt.
17. Cada mañana: leer el reporte, probar 5 minutos, decir qué no te gustó.
    El agente lo convierte en ítems.
