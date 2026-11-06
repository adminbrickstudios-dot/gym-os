// Cómo se comporta la ventana de Entrada. Por gimnasio (datos) y "en esta compu" (el navegador).
export type ConfigEntrada = {
  abrir_al_tipear: boolean;
  barra_fija: boolean;
  anotar_solo_en_verde: boolean;
  /** Segundos hasta que la ventana se cierra sola después de anotar; 0 = no se cierra sola. */
  cerrar_sola_seg: 0 | 3 | 4 | 6;
};

export const CONFIG_ENTRADA_POR_DEFECTO: ConfigEntrada = { abrir_al_tipear: true, barra_fija: false, anotar_solo_en_verde: false, cerrar_sola_seg: 4 };

/** Lo que una compu puntual le pisa al gimnasio (solo estos dos; el resto es del gimnasio). */
export type PisadoEnEstaCompu = { abrir_al_tipear?: boolean; barra_fija?: boolean };

export const CLAVE_PISADO = "gymos.entrada.en-esta-compu";
export const EVENTO_PISADO = "gymos:entrada-config";

export function leerPisado(): PisadoEnEstaCompu {
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE_PISADO) ?? "{}") as Record<string, unknown>;
    const r: PisadoEnEstaCompu = {};
    if (typeof x.abrir_al_tipear === "boolean") r.abrir_al_tipear = x.abrir_al_tipear;
    if (typeof x.barra_fija === "boolean") r.barra_fija = x.barra_fija;
    return r;
  } catch { return {}; }
}

export function guardarPisado(p: PisadoEnEstaCompu) {
  try { localStorage.setItem(CLAVE_PISADO, JSON.stringify(p)); } catch { /* sin almacenamiento: queda lo del gimnasio */ }
  window.dispatchEvent(new Event(EVENTO_PISADO));
}

export const efectiva = (gimnasio: ConfigEntrada, pisado: PisadoEnEstaCompu): ConfigEntrada => ({ ...gimnasio, ...pisado });
