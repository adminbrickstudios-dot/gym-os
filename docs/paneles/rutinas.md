# Rutinas · inventario (RUT-1)

Rutas `/panel/rutinas` y `/panel/rutinas/editar`. Las ven y arman el dueño, el encargado y los profes. Se apaga por gimnasio (`rutinas`).

Probado haciendo clic con `npm run e2e:rut-1`.

| Elemento | Qué hace hoy | Anda | Qué le falta | Se conecta con | Configurable |
|---|---|---|---|---|---|
| Rutinas | Lista con días y ejercicios; abre el editor. | ✅ | — | `rutinas_gimnasio` | — |
| ➕ Nueva rutina | Aparece cuando hay ejercicios. | ✅ | — | — | — |
| Editor | Nombre, para quién, días (hasta 7), en cada día los ejercicios con series, repeticiones ("8-10", "30 s") y nota. Guardar reemplaza; Archivar la saca. | ✅ | Reordenar arrastrando | `rutina_detalle`, `guardar_rutina`, `archivar_rutina` | — |
| 👤 Asignar a un socio | En una rutina: buscar por nombre y asignar (reemplaza la que tenía). | ✅ (RUT-2) | Verla en la ficha | `asignar_rutina` | — |
| Ejercicios | Nombre (único), grupo muscular, video por link (https). Sacar lo apaga (las rutinas que ya lo usan lo siguen mostrando). | ✅ | Editar nombre o video | `ejercicios_gimnasio`, `guardar_ejercicio` | — |

Nada de salud: ni lesiones ni condiciones. Peso levantado sí (RUT-2).

En la app del socio: "💪 Mi rutina" por día, con "✍️ Anotar" kilos y repeticiones (RUT-2).
