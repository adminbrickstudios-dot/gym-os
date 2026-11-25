
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "aceptaciones_reglamento": {
                  Row: {
                    "aceptado_en": string,"gimnasio_id": string,"id": string,"reglamento_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aceptado_en"?: string,"gimnasio_id": string,"id"?: string,"reglamento_id": string,"socio_id": string
                  }
                  Update: {
                    "aceptado_en"?: string,"gimnasio_id"?: string,"id"?: string,"reglamento_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aceptaciones_reglamento_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aceptaciones_reglamento_gimnasio_id_reglamento_id_fkey"
      columns: ["gimnasio_id","reglamento_id"]
isOneToOne: false
      referencedRelation: "reglamentos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "aceptaciones_reglamento_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"actividades": {
                  Row: {
                    "activa": boolean,"color": string | null,"creado_en": string,"descripcion": string | null,"emoji": string | null,"gimnasio_id": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"color"?: string | null,"creado_en"?: string,"descripcion"?: string | null,"emoji"?: string | null,"gimnasio_id": string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "activa"?: boolean,"color"?: string | null,"creado_en"?: string,"descripcion"?: string | null,"emoji"?: string | null,"gimnasio_id"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "actividades_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"administradores_plataforma": {
                  Row: {
                    "creado_en": string,"rol": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"rol"?: string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"rol"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ajustes_autoservicio": {
                  Row: {
                    "actualizado_en": string,"compras_app": boolean,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"compras_app"?: boolean,"gimnasio_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"compras_app"?: boolean,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ajustes_autoservicio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"alertas_prestamo": {
                  Row: {
                    "creado_en": string,"dispositivo_anterior_id": string | null,"dispositivo_nuevo_id": string | null,"gimnasio_id": string,"id": string,"ingreso_anterior_id": string,"minutos": number,"momento": string,"sede_id": string,"socio_id": string,"via_anterior": string,"via_nueva": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dispositivo_anterior_id"?: string | null,"dispositivo_nuevo_id"?: string | null,"gimnasio_id": string,"id"?: string,"ingreso_anterior_id": string,"minutos": number,"momento": string,"sede_id": string,"socio_id": string,"via_anterior": string,"via_nueva": string
                  }
                  Update: {
                    "creado_en"?: string,"dispositivo_anterior_id"?: string | null,"dispositivo_nuevo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"ingreso_anterior_id"?: string,"minutos"?: number,"momento"?: string,"sede_id"?: string,"socio_id"?: string,"via_anterior"?: string,"via_nueva"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alertas_prestamo_gimnasio_id_dispositivo_anterior_id_fkey"
      columns: ["gimnasio_id","dispositivo_anterior_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alertas_prestamo_gimnasio_id_dispositivo_nuevo_id_fkey"
      columns: ["gimnasio_id","dispositivo_nuevo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alertas_prestamo_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alertas_prestamo_gimnasio_id_ingreso_anterior_id_fkey"
      columns: ["gimnasio_id","ingreso_anterior_id"]
isOneToOne: false
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alertas_prestamo_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alertas_prestamo_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"alertas_seguridad": {
                  Row: {
                    "creado_en": string,"datos": NonNullable<Json>,"equipo_id": string | null,"gimnasio_id": string,"id": string,"tipo": string,"vista_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"datos"?: NonNullable<Json>,"equipo_id"?: string | null,"gimnasio_id": string,"id"?: string,"tipo": string,"vista_en"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"datos"?: NonNullable<Json>,"equipo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"tipo"?: string,"vista_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alertas_seguridad_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alertas_seguridad_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"alquileres_locker": {
                  Row: {
                    "cortesia_motivo": string | null,"creado_en": string,"creado_por": string,"desde": string,"gimnasio_id": string,"hasta": string,"id": string,"liberado_en": string | null,"liberado_motivo": string | null,"liberado_por": string | null,"locker_id": string,"socio_id": string,"venta_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cortesia_motivo"?: string | null,"creado_en"?: string,"creado_por": string,"desde": string,"gimnasio_id": string,"hasta": string,"id"?: string,"liberado_en"?: string | null,"liberado_motivo"?: string | null,"liberado_por"?: string | null,"locker_id": string,"socio_id": string,"venta_item_id"?: string | null
                  }
                  Update: {
                    "cortesia_motivo"?: string | null,"creado_en"?: string,"creado_por"?: string,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"liberado_en"?: string | null,"liberado_motivo"?: string | null,"liberado_por"?: string | null,"locker_id"?: string,"socio_id"?: string,"venta_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alquileres_locker_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alquileres_locker_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alquileres_locker_gimnasio_id_liberado_por_fkey"
      columns: ["gimnasio_id","liberado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alquileres_locker_gimnasio_id_locker_id_fkey"
      columns: ["gimnasio_id","locker_id"]
isOneToOne: false
      referencedRelation: "lockers"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alquileres_locker_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "alquileres_locker_gimnasio_id_venta_item_id_fkey"
      columns: ["gimnasio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"aptos_fisicos": {
                  Row: {
                    "anulado_en": string | null,"cargado_en": string,"cargado_por": string | null,"gimnasio_id": string,"id": string,"socio_id": string,"vale_hasta": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"cargado_en"?: string,"cargado_por"?: string | null,"gimnasio_id": string,"id"?: string,"socio_id": string,"vale_hasta": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"cargado_en"?: string,"cargado_por"?: string | null,"gimnasio_id"?: string,"id"?: string,"socio_id"?: string,"vale_hasta"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aptos_fisicos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aptos_fisicos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"asistencias": {
                  Row: {
                    "anulada_en": string | null,"anulada_motivo": string | null,"anulada_por": string | null,"clase_id": string,"creado_en": string,"gimnasio_id": string,"id": string,"registrado_por": string | null,"reserva_id": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"clase_id": string,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"registrado_por"?: string | null,"reserva_id"?: string | null,"socio_id": string
                  }
                  Update: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"clase_id"?: string,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"registrado_por"?: string | null,"reserva_id"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "asistencias_gimnasio_id_anulada_por_fkey"
      columns: ["gimnasio_id","anulada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "asistencias_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "asistencias_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asistencias_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "asistencias_gimnasio_id_reserva_id_fkey"
      columns: ["gimnasio_id","reserva_id"]
isOneToOne: false
      referencedRelation: "reservas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "asistencias_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"aumentos_precio": {
                  Row: {
                    "aviso_dias_exigido": number,"aviso_dias_reales": number,"creado_en": string,"creado_por": string,"creado_por_rol": string,"excepcion_motivo": string | null,"gimnasio_id": string,"id": string,"planes": NonNullable<Json>,"redondeo": number,"socios_avisados": number,"tipo": string,"valor": number,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aviso_dias_exigido": number,"aviso_dias_reales": number,"creado_en"?: string,"creado_por": string,"creado_por_rol": string,"excepcion_motivo"?: string | null,"gimnasio_id": string,"id"?: string,"planes": NonNullable<Json>,"redondeo"?: number,"socios_avisados"?: number,"tipo": string,"valor": number,"vigente_desde": string
                  }
                  Update: {
                    "aviso_dias_exigido"?: number,"aviso_dias_reales"?: number,"creado_en"?: string,"creado_por"?: string,"creado_por_rol"?: string,"excepcion_motivo"?: string | null,"gimnasio_id"?: string,"id"?: string,"planes"?: NonNullable<Json>,"redondeo"?: number,"socios_avisados"?: number,"tipo"?: string,"valor"?: number,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aumentos_precio_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "aumentos_precio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"avisos_clase": {
                  Row: {
                    "clase_id": string,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"personas": number,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clase_id": string,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"personas"?: number,"texto": string
                  }
                  Update: {
                    "clase_id"?: string,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"personas"?: number,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_clase_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "avisos_clase_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "avisos_clase_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"avisos_enviados": {
                  Row: {
                    "clave": string,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"referencia": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"referencia": string,"socio_id": string
                  }
                  Update: {
                    "clave"?: string,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"referencia"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_enviados_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "avisos_enviados_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avisos_enviados_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"avisos_leidos": {
                  Row: {
                    "clave": string,"gimnasio_id": string,"id": string,"leido_en": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"gimnasio_id": string,"id"?: string,"leido_en"?: string,"usuario_id": string
                  }
                  Update: {
                    "clave"?: string,"gimnasio_id"?: string,"id"?: string,"leido_en"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_leidos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"avisos_mantenimiento": {
                  Row: {
                    "cancelado_en": string | null,"creado_en": string,"creado_por": string,"desde": string,"hasta": string,"id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelado_en"?: string | null,"creado_en"?: string,"creado_por": string,"desde": string,"hasta": string,"id"?: string,"texto": string
                  }
                  Update: {
                    "cancelado_en"?: string | null,"creado_en"?: string,"creado_por"?: string,"desde"?: string,"hasta"?: string,"id"?: string,"texto"?: string
                  }
                  Relationships: [
                    
                  ]
                },"avisos_pendientes": {
                  Row: {
                    "clase_id": string | null,"creado_en": string,"enviado_en": string | null,"gimnasio_id": string,"id": string,"socio_id": string,"texto": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clase_id"?: string | null,"creado_en"?: string,"enviado_en"?: string | null,"gimnasio_id": string,"id"?: string,"socio_id": string,"texto": string,"tipo": string
                  }
                  Update: {
                    "clase_id"?: string | null,"creado_en"?: string,"enviado_en"?: string | null,"gimnasio_id"?: string,"id"?: string,"socio_id"?: string,"texto"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_pendientes_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "avisos_pendientes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avisos_pendientes_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"avisos_socio": {
                  Row: {
                    "aumento_id": string | null,"creado_en": string,"gimnasio_id": string,"id": string,"leido_en": string | null,"socio_id": string,"texto": string,"tipo": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aumento_id"?: string | null,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"leido_en"?: string | null,"socio_id": string,"texto": string,"tipo": string,"titulo": string
                  }
                  Update: {
                    "aumento_id"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"leido_en"?: string | null,"socio_id"?: string,"texto"?: string,"tipo"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "avisos_socio_gimnasio_id_aumento_id_fkey"
      columns: ["gimnasio_id","aumento_id"]
isOneToOne: false
      referencedRelation: "aumentos_precio"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "avisos_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "avisos_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"ayudas_brik": {
                  Row: {
                    "creado_en": string,"equipo_id": string,"gimnasio_id": string,"id": string,"mensaje": string,"pantalla": string | null,"resuelta_en": string | null,"resuelta_por": string | null,"ultimo_error": string | null,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"equipo_id": string,"gimnasio_id": string,"id"?: string,"mensaje": string,"pantalla"?: string | null,"resuelta_en"?: string | null,"resuelta_por"?: string | null,"ultimo_error"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"equipo_id"?: string,"gimnasio_id"?: string,"id"?: string,"mensaje"?: string,"pantalla"?: string | null,"resuelta_en"?: string | null,"resuelta_por"?: string | null,"ultimo_error"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ayudas_brik_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ayudas_brik_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"ayudas_usuario": {
                  Row: {
                    "clave": string,"usuario_id": string,"visto_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"usuario_id": string,"visto_en"?: string
                  }
                  Update: {
                    "clave"?: string,"usuario_id"?: string,"visto_en"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cajas": {
                  Row: {
                    "activa": boolean,"creado_en": string,"gimnasio_id": string,"id": string,"nombre": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string,"sede_id": string
                  }
                  Update: {
                    "activa"?: boolean,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cajas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cajas_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"cambios_cobro": {
                  Row: {
                    "antes": Json | null,"cambiado_en": string,"despues": Json | null,"detalle": string,"equipo_id": string | null,"gimnasio_id": string,"id": string,"tema": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "antes"?: Json | null,"cambiado_en"?: string,"despues"?: Json | null,"detalle": string,"equipo_id"?: string | null,"gimnasio_id": string,"id"?: string,"tema": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "antes"?: Json | null,"cambiado_en"?: string,"despues"?: Json | null,"detalle"?: string,"equipo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"tema"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cambios_cobro_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cambios_cobro_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"cambios_plan_app": {
                  Row: {
                    "aplicado_en": string | null,"creado_en": string,"gimnasio_id": string,"id": string,"plan_id": string,"socio_id": string,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aplicado_en"?: string | null,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"plan_id": string,"socio_id": string,"venta_id": string
                  }
                  Update: {
                    "aplicado_en"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"plan_id"?: string,"socio_id"?: string,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cambios_plan_app_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cambios_plan_app_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cambios_plan_app_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cambios_plan_app_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: true
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"cierres": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"compensa": boolean,"creado_en": string,"creado_por": string | null,"desde": string,"gimnasio_id": string,"hasta": string,"id": string,"motivo": string,"sede_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"compensa"?: boolean,"creado_en"?: string,"creado_por"?: string | null,"desde": string,"gimnasio_id": string,"hasta": string,"id"?: string,"motivo": string,"sede_id"?: string | null
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"compensa"?: boolean,"creado_en"?: string,"creado_por"?: string | null,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"motivo"?: string,"sede_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cierres_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cierres_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"clases": {
                  Row: {
                    "actividad_id": string,"cancelada_en": string | null,"cancelada_motivo": string | null,"cierre_id": string | null,"creado_en": string,"cupo": number | null,"fin": string,"gimnasio_id": string,"horario_id": string | null,"id": string,"inicio": string,"profe_id": string | null,"sede_id": string,"wod": string | null,"wod_en": string | null,"wod_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cierre_id"?: string | null,"creado_en"?: string,"cupo"?: number | null,"fin": string,"gimnasio_id": string,"horario_id"?: string | null,"id"?: string,"inicio": string,"profe_id"?: string | null,"sede_id": string,"wod"?: string | null,"wod_en"?: string | null,"wod_por"?: string | null
                  }
                  Update: {
                    "actividad_id"?: string,"cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cierre_id"?: string | null,"creado_en"?: string,"cupo"?: number | null,"fin"?: string,"gimnasio_id"?: string,"horario_id"?: string | null,"id"?: string,"inicio"?: string,"profe_id"?: string | null,"sede_id"?: string,"wod"?: string | null,"wod_en"?: string | null,"wod_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clases_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "clases_gimnasio_id_cierre_id_fkey"
      columns: ["gimnasio_id","cierre_id"]
isOneToOne: false
      referencedRelation: "cierres"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "clases_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clases_gimnasio_id_horario_id_fkey"
      columns: ["gimnasio_id","horario_id"]
isOneToOne: false
      referencedRelation: "horarios_clase"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "clases_gimnasio_id_profe_id_fkey"
      columns: ["gimnasio_id","profe_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "clases_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "clases_wod_por_fk"
      columns: ["gimnasio_id","wod_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"claves_entregadas": {
                  Row: {
                    "creado_en": string,"cuenta_creada": boolean,"equipo_id": string | null,"gimnasio_id": string,"id": string,"por_equipo_id": string,"por_usuario_id": string | null,"socio_id": string | null,"visto_por_socio_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"cuenta_creada"?: boolean,"equipo_id"?: string | null,"gimnasio_id": string,"id"?: string,"por_equipo_id": string,"por_usuario_id"?: string | null,"socio_id"?: string | null,"visto_por_socio_en"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"cuenta_creada"?: boolean,"equipo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"por_equipo_id"?: string,"por_usuario_id"?: string | null,"socio_id"?: string | null,"visto_por_socio_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "claves_entregadas_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "claves_entregadas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claves_entregadas_gimnasio_id_por_equipo_id_fkey"
      columns: ["gimnasio_id","por_equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "claves_entregadas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"coberturas": {
                  Row: {
                    "ancla_dia": number | null,"anulada_en": string | null,"anulada_motivo": string | null,"anulada_por": string | null,"creado_en": string,"creado_por": string | null,"desde": string,"gimnasio_id": string,"hasta": string,"id": string,"importacion_id": string | null,"motivo": string | null,"origen": string,"socio_id": string,"suscripcion_id": string,"venta_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ancla_dia"?: number | null,"anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"desde": string,"gimnasio_id": string,"hasta": string,"id"?: string,"importacion_id"?: string | null,"motivo"?: string | null,"origen": string,"socio_id": string,"suscripcion_id": string,"venta_item_id"?: string | null
                  }
                  Update: {
                    "ancla_dia"?: number | null,"anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"importacion_id"?: string | null,"motivo"?: string | null,"origen"?: string,"socio_id"?: string,"suscripcion_id"?: string,"venta_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "coberturas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coberturas_gimnasio_id_venta_item_id_fkey"
      columns: ["gimnasio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "coberturas_importacion_fk"
      columns: ["gimnasio_id","importacion_id"]
isOneToOne: false
      referencedRelation: "importaciones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "coberturas_suscripcion_diferible"
      columns: ["gimnasio_id","suscripcion_id","socio_id"]
isOneToOne: false
      referencedRelation: "suscripciones"
      referencedColumns: ["gimnasio_id","id","socio_id"]
    }
                  ]
                },"cobros_debito": {
                  Row: {
                    "adhesion_id": string,"creado_en": string,"estado": string,"gimnasio_id": string,"id": string,"monto": number,"mp_pago_id": string,"pago_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adhesion_id": string,"creado_en"?: string,"estado": string,"gimnasio_id": string,"id"?: string,"monto": number,"mp_pago_id": string,"pago_id"?: string | null
                  }
                  Update: {
                    "adhesion_id"?: string,"creado_en"?: string,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"monto"?: number,"mp_pago_id"?: string,"pago_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cobros_debito_gimnasio_id_adhesion_id_fkey"
      columns: ["gimnasio_id","adhesion_id"]
isOneToOne: false
      referencedRelation: "debitos_automaticos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cobros_debito_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cobros_debito_gimnasio_id_pago_id_fkey"
      columns: ["gimnasio_id","pago_id"]
isOneToOne: false
      referencedRelation: "pagos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"config_aumentos": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"aviso_dias": number,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"aviso_dias"?: number,"gimnasio_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"aviso_dias"?: number,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_aumentos_gimnasio_id_actualizado_por_fkey"
      columns: ["gimnasio_id","actualizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "config_aumentos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"config_mensajes": {
                  Row: {
                    "actualizado_en": string,"gimnasio_id": string,"recepcion_ve": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"gimnasio_id": string,"recepcion_ve"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"gimnasio_id"?: string,"recepcion_ve"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_mensajes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_caja": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"fondo_fijo": number,"gimnasio_id": string,"hora_corte": string,"horas_max": number,"modo": string,"pedir_billetes": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"fondo_fijo"?: number,"gimnasio_id": string,"hora_corte"?: string,"horas_max"?: number,"modo"?: string,"pedir_billetes"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"fondo_fijo"?: number,"gimnasio_id"?: string,"hora_corte"?: string,"horas_max"?: number,"modo"?: string,"pedir_billetes"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_caja_gimnasio_id_actualizado_por_fkey"
      columns: ["gimnasio_id","actualizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "configuracion_caja_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_cierres": {
                  Row: {
                    "actualizado_en": string,"gimnasio_id": string,"suma_dias": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"gimnasio_id": string,"suma_dias"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"gimnasio_id"?: string,"suma_dias"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_cierres_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_cobro": {
                  Row: {
                    "actualizado_en": string,"doble_cobro_minutos": number,"gimnasio_id": string,"medio_defecto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"doble_cobro_minutos"?: number,"gimnasio_id": string,"medio_defecto"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"doble_cobro_minutos"?: number,"gimnasio_id"?: string,"medio_defecto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_cobro_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_dejar_pasar": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"dias_max": number,"gimnasio_id": string,"modo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"dias_max"?: number,"gimnasio_id": string,"modo"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"dias_max"?: number,"gimnasio_id"?: string,"modo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_dejar_pasar_gimnasio_id_actualizado_por_fkey"
      columns: ["gimnasio_id","actualizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "configuracion_dejar_pasar_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_entrada": {
                  Row: {
                    "abrir_al_tipear": boolean,"actualizado_en": string,"anotar_solo_en_verde": boolean,"barra_fija": boolean,"cerrar_por_inactividad_min": number,"cerrar_sola_seg": number,"gimnasio_id": string,"resultado_entrada": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abrir_al_tipear"?: boolean,"actualizado_en"?: string,"anotar_solo_en_verde"?: boolean,"barra_fija"?: boolean,"cerrar_por_inactividad_min"?: number,"cerrar_sola_seg"?: number,"gimnasio_id": string,"resultado_entrada"?: string
                  }
                  Update: {
                    "abrir_al_tipear"?: boolean,"actualizado_en"?: string,"anotar_solo_en_verde"?: boolean,"barra_fija"?: boolean,"cerrar_por_inactividad_min"?: number,"cerrar_sola_seg"?: number,"gimnasio_id"?: string,"resultado_entrada"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_entrada_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_fichaje": {
                  Row: {
                    "actualizado_en": string,"gimnasio_id": string,"tope_horas": number,"usa": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"gimnasio_id": string,"tope_horas"?: number,"usa"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"gimnasio_id"?: string,"tope_horas"?: number,"usa"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_fichaje_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_gimnasio": {
                  Row: {
                    "accesos_activos": (string)[],"actualizado_en": string,"actualizado_por": string | null,"alias_transferencia": string | null,"alta_plan_sugerido_id": string | null,"altas_online": boolean,"apto_aviso_dias": number,"apto_en_entrada": string,"avisar_sin_bloquear_hasta": string | null,"banco_transferencia": string | null,"cancelacion_horas_limite": number,"casi_lleno_pct": number,"cbu": string | null,"ciudad": string | null,"cobra_membresia": boolean,"cobra_pack": boolean,"cobra_pase": boolean,"color_acento": string,"color_fondo": string,"cortesia_alerta_repetidas": number,"cortesia_dias_mes_encargado": number,"cortesia_dias_mes_recepcion": number,"cortesia_max_dias_encargado": number,"cortesia_max_dias_recepcion": number,"crear_cuenta_visible": boolean,"cuit_facturacion": string | null,"descuento_max_recepcion": number,"devolucion_baja_modo": string,"dias_aviso": number,"emergencia_puerta_habilitada": boolean,"encargado_ve_gastos": boolean,"encargado_ve_resultado": boolean,"espera_plazo_min": number | null,"estilo": string,"falta_bloqueo_dias": number,"falta_politica": string,"falta_politica_desde": string | null,"favicon_path": string | null,"fiado_activo": boolean,"fiado_tope": number,"foto_socio_permitida": boolean,"funciones_nuevas": (string)[],"gimnasio_id": string,"invitados_por_mes": number,"kiosco_habituales": boolean,"link_resena": string | null,"logo_path": string | null,"medios_aceptados": (string)[],"meta_primer_mes": number,"meta_visitas_mes": number,"modo": string,"modo_clases": string,"mostrar_vuelto_efectivo": boolean,"numeros_inicio": (string)[],"ocupacion_visible_socios": boolean,"onboarding_salteado_en": string | null,"pausa_auto_max_dias": number,"pausa_autoaprobar": boolean,"pausa_dias_por_anio": number,"pide_apto": boolean,"plan_familiar_activo": boolean,"politica_privacidad": string | null,"politica_privacidad_en": string | null,"profe_ve_telefono": boolean,"prueba_gratis": string,"pt_cancelar_horas": number,"razon_social": string | null,"recargo_dias": number,"recargo_tipo": string,"recargo_valor": number,"recepcion_ve_cobrado": boolean,"recepcion_vende_productos": boolean,"reingreso_mismo_dia_consume": boolean,"reserva_dias_anticipacion": number,"retencion_dias_ausencia": number,"retencion_dias_nuevo": number,"retencion_dias_se_fue": number,"retencion_dias_vencido": number,"secciones_apagadas": (string)[],"titular_cuenta": string | null,"tolerancia_dias": number,"tope_dejar_pasar": number,"turnos_fijos": boolean,"ultimo_numero_socio": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accesos_activos"?: (string)[],"actualizado_en"?: string,"actualizado_por"?: string | null,"alias_transferencia"?: string | null,"alta_plan_sugerido_id"?: string | null,"altas_online"?: boolean,"apto_aviso_dias"?: number,"apto_en_entrada"?: string,"avisar_sin_bloquear_hasta"?: string | null,"banco_transferencia"?: string | null,"cancelacion_horas_limite"?: number,"casi_lleno_pct"?: number,"cbu"?: string | null,"ciudad"?: string | null,"cobra_membresia"?: boolean,"cobra_pack"?: boolean,"cobra_pase"?: boolean,"color_acento"?: string,"color_fondo"?: string,"cortesia_alerta_repetidas"?: number,"cortesia_dias_mes_encargado"?: number,"cortesia_dias_mes_recepcion"?: number,"cortesia_max_dias_encargado"?: number,"cortesia_max_dias_recepcion"?: number,"crear_cuenta_visible"?: boolean,"cuit_facturacion"?: string | null,"descuento_max_recepcion"?: number,"devolucion_baja_modo"?: string,"dias_aviso"?: number,"emergencia_puerta_habilitada"?: boolean,"encargado_ve_gastos"?: boolean,"encargado_ve_resultado"?: boolean,"espera_plazo_min"?: number | null,"estilo"?: string,"falta_bloqueo_dias"?: number,"falta_politica"?: string,"falta_politica_desde"?: string | null,"favicon_path"?: string | null,"fiado_activo"?: boolean,"fiado_tope"?: number,"foto_socio_permitida"?: boolean,"funciones_nuevas"?: (string)[],"gimnasio_id": string,"invitados_por_mes"?: number,"kiosco_habituales"?: boolean,"link_resena"?: string | null,"logo_path"?: string | null,"medios_aceptados"?: (string)[],"meta_primer_mes"?: number,"meta_visitas_mes"?: number,"modo"?: string,"modo_clases"?: string,"mostrar_vuelto_efectivo"?: boolean,"numeros_inicio"?: (string)[],"ocupacion_visible_socios"?: boolean,"onboarding_salteado_en"?: string | null,"pausa_auto_max_dias"?: number,"pausa_autoaprobar"?: boolean,"pausa_dias_por_anio"?: number,"pide_apto"?: boolean,"plan_familiar_activo"?: boolean,"politica_privacidad"?: string | null,"politica_privacidad_en"?: string | null,"profe_ve_telefono"?: boolean,"prueba_gratis"?: string,"pt_cancelar_horas"?: number,"razon_social"?: string | null,"recargo_dias"?: number,"recargo_tipo"?: string,"recargo_valor"?: number,"recepcion_ve_cobrado"?: boolean,"recepcion_vende_productos"?: boolean,"reingreso_mismo_dia_consume"?: boolean,"reserva_dias_anticipacion"?: number,"retencion_dias_ausencia"?: number,"retencion_dias_nuevo"?: number,"retencion_dias_se_fue"?: number,"retencion_dias_vencido"?: number,"secciones_apagadas"?: (string)[],"titular_cuenta"?: string | null,"tolerancia_dias"?: number,"tope_dejar_pasar"?: number,"turnos_fijos"?: boolean,"ultimo_numero_socio"?: number
                  }
                  Update: {
                    "accesos_activos"?: (string)[],"actualizado_en"?: string,"actualizado_por"?: string | null,"alias_transferencia"?: string | null,"alta_plan_sugerido_id"?: string | null,"altas_online"?: boolean,"apto_aviso_dias"?: number,"apto_en_entrada"?: string,"avisar_sin_bloquear_hasta"?: string | null,"banco_transferencia"?: string | null,"cancelacion_horas_limite"?: number,"casi_lleno_pct"?: number,"cbu"?: string | null,"ciudad"?: string | null,"cobra_membresia"?: boolean,"cobra_pack"?: boolean,"cobra_pase"?: boolean,"color_acento"?: string,"color_fondo"?: string,"cortesia_alerta_repetidas"?: number,"cortesia_dias_mes_encargado"?: number,"cortesia_dias_mes_recepcion"?: number,"cortesia_max_dias_encargado"?: number,"cortesia_max_dias_recepcion"?: number,"crear_cuenta_visible"?: boolean,"cuit_facturacion"?: string | null,"descuento_max_recepcion"?: number,"devolucion_baja_modo"?: string,"dias_aviso"?: number,"emergencia_puerta_habilitada"?: boolean,"encargado_ve_gastos"?: boolean,"encargado_ve_resultado"?: boolean,"espera_plazo_min"?: number | null,"estilo"?: string,"falta_bloqueo_dias"?: number,"falta_politica"?: string,"falta_politica_desde"?: string | null,"favicon_path"?: string | null,"fiado_activo"?: boolean,"fiado_tope"?: number,"foto_socio_permitida"?: boolean,"funciones_nuevas"?: (string)[],"gimnasio_id"?: string,"invitados_por_mes"?: number,"kiosco_habituales"?: boolean,"link_resena"?: string | null,"logo_path"?: string | null,"medios_aceptados"?: (string)[],"meta_primer_mes"?: number,"meta_visitas_mes"?: number,"modo"?: string,"modo_clases"?: string,"mostrar_vuelto_efectivo"?: boolean,"numeros_inicio"?: (string)[],"ocupacion_visible_socios"?: boolean,"onboarding_salteado_en"?: string | null,"pausa_auto_max_dias"?: number,"pausa_autoaprobar"?: boolean,"pausa_dias_por_anio"?: number,"pide_apto"?: boolean,"plan_familiar_activo"?: boolean,"politica_privacidad"?: string | null,"politica_privacidad_en"?: string | null,"profe_ve_telefono"?: boolean,"prueba_gratis"?: string,"pt_cancelar_horas"?: number,"razon_social"?: string | null,"recargo_dias"?: number,"recargo_tipo"?: string,"recargo_valor"?: number,"recepcion_ve_cobrado"?: boolean,"recepcion_vende_productos"?: boolean,"reingreso_mismo_dia_consume"?: boolean,"reserva_dias_anticipacion"?: number,"retencion_dias_ausencia"?: number,"retencion_dias_nuevo"?: number,"retencion_dias_se_fue"?: number,"retencion_dias_vencido"?: number,"secciones_apagadas"?: (string)[],"titular_cuenta"?: string | null,"tolerancia_dias"?: number,"tope_dejar_pasar"?: number,"turnos_fijos"?: boolean,"ultimo_numero_socio"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_alta_plan_sugerido_fk"
      columns: ["gimnasio_id","alta_plan_sugerido_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "configuracion_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_liquidacion": {
                  Row: {
                    "actualizado_en": string,"encargado_ve": boolean,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"encargado_ve"?: boolean,"gimnasio_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"encargado_ve"?: boolean,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_liquidacion_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_vencimiento": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"dia_fijo": number | null,"gimnasio_id": string,"primera_cuota": string,"redondeo": number,"renovacion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"dia_fijo"?: number | null,"gimnasio_id": string,"primera_cuota"?: string,"redondeo"?: number,"renovacion"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"dia_fijo"?: number | null,"gimnasio_id"?: string,"primera_cuota"?: string,"redondeo"?: number,"renovacion"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_vencimiento_gimnasio_id_actualizado_por_fkey"
      columns: ["gimnasio_id","actualizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "configuracion_vencimiento_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"configuracion_visita": {
                  Row: {
                    "actualizado_en": string,"antiprestamo_minutos": number,"avisar_en_vivo": boolean,"gimnasio_id": string,"registrar_salida": string,"visita_horas": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"antiprestamo_minutos"?: number,"avisar_en_vivo"?: boolean,"gimnasio_id": string,"registrar_salida"?: string,"visita_horas"?: number
                  }
                  Update: {
                    "actualizado_en"?: string,"antiprestamo_minutos"?: number,"avisar_en_vivo"?: boolean,"gimnasio_id"?: string,"registrar_salida"?: string,"visita_horas"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuracion_visita_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"congelamientos": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"categoria": string,"creado_en": string,"creado_por": string | null,"desde": string,"gimnasio_id": string,"hasta_prevista": string,"hasta_real": string | null,"id": string,"nota": string | null,"socio_id": string,"suscripcion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"categoria": string,"creado_en"?: string,"creado_por"?: string | null,"desde": string,"gimnasio_id": string,"hasta_prevista": string,"hasta_real"?: string | null,"id"?: string,"nota"?: string | null,"socio_id": string,"suscripcion_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"categoria"?: string,"creado_en"?: string,"creado_por"?: string | null,"desde"?: string,"gimnasio_id"?: string,"hasta_prevista"?: string,"hasta_real"?: string | null,"id"?: string,"nota"?: string | null,"socio_id"?: string,"suscripcion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "congelamientos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "congelamientos_suscripcion_diferible"
      columns: ["gimnasio_id","suscripcion_id","socio_id"]
isOneToOne: false
      referencedRelation: "suscripciones"
      referencedColumns: ["gimnasio_id","id","socio_id"]
    }
                  ]
                },"consumos_pack": {
                  Row: {
                    "anulado_en": string | null,"asistencia_id": string | null,"creado_en": string,"gimnasio_id": string,"id": string,"ingreso_id": string | null,"momento": string,"pack_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"asistencia_id"?: string | null,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"ingreso_id"?: string | null,"momento"?: string,"pack_id": string,"socio_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"asistencia_id"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"ingreso_id"?: string | null,"momento"?: string,"pack_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consumos_pack_asistencia_fk"
      columns: ["gimnasio_id","asistencia_id"]
isOneToOne: false
      referencedRelation: "asistencias"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "consumos_pack_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consumos_pack_gimnasio_id_pack_id_fkey"
      columns: ["gimnasio_id","pack_id"]
isOneToOne: false
      referencedRelation: "packs"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "consumos_pack_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "consumos_pack_ingreso_fk"
      columns: ["gimnasio_id","ingreso_id"]
isOneToOne: false
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"contactos_retencion": {
                  Row: {
                    "canal": string,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"lista": string | null,"nota": string | null,"resultado": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canal"?: string,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"lista"?: string | null,"nota"?: string | null,"resultado"?: string,"socio_id": string
                  }
                  Update: {
                    "canal"?: string,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"lista"?: string | null,"nota"?: string | null,"resultado"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contactos_retencion_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "contactos_retencion_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contactos_retencion_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"contadores_recibo": {
                  Row: {
                    "gimnasio_id": string,"ultimo": number
                  }
                  ComputedFields: never
                  Insert: {
                    "gimnasio_id": string,"ultimo"?: number
                  }
                  Update: {
                    "gimnasio_id"?: string,"ultimo"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contadores_recibo_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"convenios": {
                  Row: {
                    "activo": boolean,"creado_en": string,"gimnasio_id": string,"id": string,"nombre": string,"tipo": string,"valor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string,"tipo": string,"valor": number
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"tipo"?: string,"valor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "convenios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"correcciones_fichaje": {
                  Row: {
                    "corregido_en": string,"corregido_por": string,"entrada_antes": string,"entrada_nueva": string,"fichaje_id": string,"gimnasio_id": string,"id": string,"motivo": string,"salida_antes": string | null,"salida_nueva": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corregido_en"?: string,"corregido_por": string,"entrada_antes": string,"entrada_nueva": string,"fichaje_id": string,"gimnasio_id": string,"id"?: string,"motivo": string,"salida_antes"?: string | null,"salida_nueva": string
                  }
                  Update: {
                    "corregido_en"?: string,"corregido_por"?: string,"entrada_antes"?: string,"entrada_nueva"?: string,"fichaje_id"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"salida_antes"?: string | null,"salida_nueva"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "correcciones_fichaje_gimnasio_id_corregido_por_fkey"
      columns: ["gimnasio_id","corregido_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "correcciones_fichaje_gimnasio_id_fichaje_id_fkey"
      columns: ["gimnasio_id","fichaje_id"]
isOneToOne: false
      referencedRelation: "fichajes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "correcciones_fichaje_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"cupones": {
                  Row: {
                    "activo": boolean,"codigo": string,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"planes": (string)[] | null,"tipo": string,"tope_usos": number | null,"valor": number,"vence_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"codigo": string,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"planes"?: (string)[] | null,"tipo": string,"tope_usos"?: number | null,"valor": number,"vence_en"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"codigo"?: string,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"planes"?: (string)[] | null,"tipo"?: string,"tope_usos"?: number | null,"valor"?: number,"vence_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cupones_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cupones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"cupones_usos": {
                  Row: {
                    "creado_en": string,"cupon_id": string,"gimnasio_id": string,"id": string,"socio_id": string | null,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"cupon_id": string,"gimnasio_id": string,"id"?: string,"socio_id"?: string | null,"venta_id": string
                  }
                  Update: {
                    "creado_en"?: string,"cupon_id"?: string,"gimnasio_id"?: string,"id"?: string,"socio_id"?: string | null,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cupones_usos_gimnasio_id_cupon_id_fkey"
      columns: ["gimnasio_id","cupon_id"]
isOneToOne: false
      referencedRelation: "cupones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cupones_usos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cupones_usos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "cupones_usos_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: true
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"debitos_automaticos": {
                  Row: {
                    "activada_en": string | null,"cancelada_en": string | null,"creada_en": string,"creada_por": string | null,"estado": string,"gimnasio_id": string,"id": string,"monto_acordado": number,"mp_suscripcion_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activada_en"?: string | null,"cancelada_en"?: string | null,"creada_en"?: string,"creada_por"?: string | null,"estado"?: string,"gimnasio_id": string,"id"?: string,"monto_acordado": number,"mp_suscripcion_id": string,"socio_id": string
                  }
                  Update: {
                    "activada_en"?: string | null,"cancelada_en"?: string | null,"creada_en"?: string,"creada_por"?: string | null,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"monto_acordado"?: number,"mp_suscripcion_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "debitos_automaticos_gimnasio_id_creada_por_fkey"
      columns: ["gimnasio_id","creada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "debitos_automaticos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "debitos_automaticos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"descuentos_brik": {
                  Row: {
                    "creado_en": string,"creado_por": string,"gimnasio_id": string,"hasta": string,"id": string,"motivo": string,"porcentaje": number,"quitado_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"gimnasio_id": string,"hasta": string,"id"?: string,"motivo": string,"porcentaje": number,"quitado_en"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"motivo"?: string,"porcentaje"?: number,"quitado_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "descuentos_brik_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"devoluciones": {
                  Row: {
                    "creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"medio": string,"modo": string,"monto": number,"monto_calculado": number,"motivo": string,"movimiento_caja_id": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"medio": string,"modo": string,"monto": number,"monto_calculado": number,"motivo": string,"movimiento_caja_id"?: string | null,"socio_id": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"medio"?: string,"modo"?: string,"monto"?: number,"monto_calculado"?: number,"motivo"?: string,"movimiento_caja_id"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devoluciones_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devoluciones_gimnasio_id_movimiento_caja_id_fkey"
      columns: ["gimnasio_id","movimiento_caja_id"]
isOneToOne: false
      referencedRelation: "movimientos_caja"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"devoluciones_anuladas": {
                  Row: {
                    "anulada_en": string,"anulada_por": string,"devolucion_id": string,"gimnasio_id": string,"id": string,"motivo": string,"movimiento_caja_id": string | null,"reintegro_caja": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string,"anulada_por": string,"devolucion_id": string,"gimnasio_id": string,"id"?: string,"motivo": string,"movimiento_caja_id"?: string | null,"reintegro_caja"?: boolean
                  }
                  Update: {
                    "anulada_en"?: string,"anulada_por"?: string,"devolucion_id"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"movimiento_caja_id"?: string | null,"reintegro_caja"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "devoluciones_anuladas_gimnasio_id_anulada_por_fkey"
      columns: ["gimnasio_id","anulada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_anuladas_gimnasio_id_devolucion_id_fkey"
      columns: ["gimnasio_id","devolucion_id"]
isOneToOne: true
      referencedRelation: "devoluciones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_anuladas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "devoluciones_anuladas_gimnasio_id_movimiento_caja_id_fkey"
      columns: ["gimnasio_id","movimiento_caja_id"]
isOneToOne: false
      referencedRelation: "movimientos_caja"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"devoluciones_items": {
                  Row: {
                    "cobertura_id": string,"devolucion_id": string,"gimnasio_id": string,"id": string,"monto": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cobertura_id": string,"devolucion_id": string,"gimnasio_id": string,"id"?: string,"monto": number
                  }
                  Update: {
                    "cobertura_id"?: string,"devolucion_id"?: string,"gimnasio_id"?: string,"id"?: string,"monto"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "devoluciones_items_gimnasio_id_cobertura_id_fkey"
      columns: ["gimnasio_id","cobertura_id"]
isOneToOne: false
      referencedRelation: "coberturas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_items_gimnasio_id_devolucion_id_fkey"
      columns: ["gimnasio_id","devolucion_id"]
isOneToOne: false
      referencedRelation: "devoluciones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "devoluciones_items_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"dispositivos": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"nombre": string,"revocado_en": string | null,"sede_id": string,"tipo": string,"ultimo_uso": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string,"revocado_en"?: string | null,"sede_id": string,"tipo": string,"ultimo_uso"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"revocado_en"?: string | null,"sede_id"?: string,"tipo"?: string,"ultimo_uso"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispositivos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispositivos_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"dispositivos_tokens": {
                  Row: {
                    "creado_en": string,"dispositivo_id": string,"gimnasio_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dispositivo_id": string,"gimnasio_id": string,"token_hash": string
                  }
                  Update: {
                    "creado_en"?: string,"dispositivo_id"?: string,"gimnasio_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispositivos_tokens_gimnasio_id_dispositivo_id_fkey"
      columns: ["gimnasio_id","dispositivo_id"]
isOneToOne: true
      referencedRelation: "dispositivos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "dispositivos_tokens_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos": {
                  Row: {
                    "activo": boolean,"clave": string,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"texto": string,"titulo": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"clave": string,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"texto": string,"titulo": string,"version": number
                  }
                  Update: {
                    "activo"?: boolean,"clave"?: string,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"texto"?: string,"titulo"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "documentos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "documentos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"dominios_gimnasio": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"host": string,"id": string,"tipo": string,"vercel_dominio_id": string | null,"verificado_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"host": string,"id"?: string,"tipo": string,"vercel_dominio_id"?: string | null,"verificado_en"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"host"?: string,"id"?: string,"tipo"?: string,"vercel_dominio_id"?: string | null,"verificado_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dominios_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"ejercicios": {
                  Row: {
                    "activo": boolean,"creado_en": string,"equipo": string,"gimnasio_id": string,"grupo": string,"id": string,"nombre": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"equipo"?: string,"gimnasio_id": string,"grupo"?: string,"id"?: string,"nombre": string,"video_url"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"equipo"?: string,"gimnasio_id"?: string,"grupo"?: string,"id"?: string,"nombre"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ejercicios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"emergencias_puerta": {
                  Row: {
                    "cerrada_en": string | null,"cerrada_por": string | null,"creado_en": string,"gimnasio_id": string,"id": string,"iniciada_en": string,"iniciada_por": string,"motivo": string,"sede_id": string,"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cerrada_en"?: string | null,"cerrada_por"?: string | null,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"iniciada_en"?: string,"iniciada_por": string,"motivo": string,"sede_id": string,"vence_en": string
                  }
                  Update: {
                    "cerrada_en"?: string | null,"cerrada_por"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"iniciada_en"?: string,"iniciada_por"?: string,"motivo"?: string,"sede_id"?: string,"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "emergencias_puerta_gimnasio_id_cerrada_por_fkey"
      columns: ["gimnasio_id","cerrada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "emergencias_puerta_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "emergencias_puerta_gimnasio_id_iniciada_por_fkey"
      columns: ["gimnasio_id","iniciada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "emergencias_puerta_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"encuestas": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"puntaje": number,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"puntaje": number,"socio_id": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"puntaje"?: number,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "encuestas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encuestas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"envios_publicos": {
                  Row: {
                    "clave_hash": string | null,"creado_en": string,"formulario": string,"id": string,"ip": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clave_hash"?: string | null,"creado_en"?: string,"formulario": string,"id"?: string,"ip"?: string | null
                  }
                  Update: {
                    "clave_hash"?: string | null,"creado_en"?: string,"formulario"?: string,"id"?: string,"ip"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"envios_push": {
                  Row: {
                    "creado_en": string,"destinos": number,"evento": string,"gimnasio_id": string,"id": string,"referencia": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"destinos"?: number,"evento": string,"gimnasio_id": string,"id"?: string,"referencia": string
                  }
                  Update: {
                    "creado_en"?: string,"destinos"?: number,"evento"?: string,"gimnasio_id"?: string,"id"?: string,"referencia"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "envios_push_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"equipo": {
                  Row: {
                    "activo": boolean,"creado_en": string,"es_soporte": boolean,"gimnasio_id": string,"id": string,"nombre": string,"preferencias": NonNullable<Json>,"rol": string,"sede_id": string | null,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"es_soporte"?: boolean,"gimnasio_id": string,"id"?: string,"nombre": string,"preferencias"?: NonNullable<Json>,"rol": string,"sede_id"?: string | null,"usuario_id"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"es_soporte"?: boolean,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"preferencias"?: NonNullable<Json>,"rol"?: string,"sede_id"?: string | null,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipo_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"equipo_actividades": {
                  Row: {
                    "actividad_id": string,"equipo_id": string,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"equipo_id": string,"gimnasio_id": string
                  }
                  Update: {
                    "actividad_id"?: string,"equipo_id"?: string,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_actividades_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "equipo_actividades_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "equipo_actividades_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"equipo_ajustes": {
                  Row: {
                    "actualizado_en": string,"gimnasio_id": string,"mostrar_en_pagina_y_app": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"gimnasio_id": string,"mostrar_en_pagina_y_app"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"gimnasio_id"?: string,"mostrar_en_pagina_y_app"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_ajustes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"equipo_horario_trabajo": {
                  Row: {
                    "desde": string,"dia": number,"equipo_id": string,"gimnasio_id": string,"hasta": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "desde": string,"dia": number,"equipo_id": string,"gimnasio_id": string,"hasta": string,"id"?: string
                  }
                  Update: {
                    "desde"?: string,"dia"?: number,"equipo_id"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_horario_trabajo_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "equipo_horario_trabajo_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"equipo_perfil": {
                  Row: {
                    "actualizado_en": string,"equipo_id": string,"foto_path": string | null,"gimnasio_id": string,"mostrar": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"equipo_id": string,"foto_path"?: string | null,"gimnasio_id": string,"mostrar"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"equipo_id"?: string,"foto_path"?: string | null,"gimnasio_id"?: string,"mostrar"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_perfil_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: true
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "equipo_perfil_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"equipo_pines": {
                  Row: {
                    "creado_en": string,"equipo_id": string,"gimnasio_id": string,"pin_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"equipo_id": string,"gimnasio_id": string,"pin_hash": string
                  }
                  Update: {
                    "creado_en"?: string,"equipo_id"?: string,"gimnasio_id"?: string,"pin_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipo_pines_equipo_fk"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: true
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "equipo_pines_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"errores_app": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string | null,"id": string,"mensaje": string,"pantalla": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id"?: string | null,"id"?: string,"mensaje": string,"pantalla": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string | null,"id"?: string,"mensaje"?: string,"pantalla"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "errores_app_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"etiquetas": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "etiquetas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"evento_asistencias": {
                  Row: {
                    "creado_por": string,"dia": string,"evento_id": string,"gimnasio_id": string,"id": string,"inscripcion_id": string | null,"momento": string,"socio_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_por": string,"dia": string,"evento_id": string,"gimnasio_id": string,"id"?: string,"inscripcion_id"?: string | null,"momento"?: string,"socio_id"?: string | null
                  }
                  Update: {
                    "creado_por"?: string,"dia"?: string,"evento_id"?: string,"gimnasio_id"?: string,"id"?: string,"inscripcion_id"?: string | null,"momento"?: string,"socio_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_asistencias_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "evento_asistencias_gimnasio_id_evento_id_fkey"
      columns: ["gimnasio_id","evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "evento_asistencias_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_asistencias_gimnasio_id_inscripcion_id_fkey"
      columns: ["gimnasio_id","inscripcion_id"]
isOneToOne: false
      referencedRelation: "evento_inscripciones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "evento_asistencias_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"evento_inscripciones": {
                  Row: {
                    "cancelada_en": string | null,"creado_en": string,"dni": string | null,"evento_id": string,"gimnasio_id": string,"id": string,"nombre": string,"origen": string,"precio": number,"socio_id": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada_en"?: string | null,"creado_en"?: string,"dni"?: string | null,"evento_id": string,"gimnasio_id": string,"id"?: string,"nombre": string,"origen": string,"precio"?: number,"socio_id"?: string | null,"telefono"?: string | null
                  }
                  Update: {
                    "cancelada_en"?: string | null,"creado_en"?: string,"dni"?: string | null,"evento_id"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"origen"?: string,"precio"?: number,"socio_id"?: string | null,"telefono"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_inscripciones_gimnasio_id_evento_id_fkey"
      columns: ["gimnasio_id","evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "evento_inscripciones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_inscripciones_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"eventos": {
                  Row: {
                    "borrador": boolean,"cerrado_en": string | null,"cerrado_motivo": string | null,"creado_en": string,"creado_por": string,"cupo": number,"descripcion": string | null,"fechas_extra": (string)[],"fin": string | null,"gimnasio_id": string,"id": string,"inicio": string,"lista_espera": boolean,"lugar": string | null,"para": string,"precio_socio": number | null,"producto_id": string,"responsable": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "borrador"?: boolean,"cerrado_en"?: string | null,"cerrado_motivo"?: string | null,"creado_en"?: string,"creado_por": string,"cupo": number,"descripcion"?: string | null,"fechas_extra"?: (string)[],"fin"?: string | null,"gimnasio_id": string,"id"?: string,"inicio": string,"lista_espera"?: boolean,"lugar"?: string | null,"para"?: string,"precio_socio"?: number | null,"producto_id": string,"responsable"?: string | null
                  }
                  Update: {
                    "borrador"?: boolean,"cerrado_en"?: string | null,"cerrado_motivo"?: string | null,"creado_en"?: string,"creado_por"?: string,"cupo"?: number,"descripcion"?: string | null,"fechas_extra"?: (string)[],"fin"?: string | null,"gimnasio_id"?: string,"id"?: string,"inicio"?: string,"lista_espera"?: boolean,"lugar"?: string | null,"para"?: string,"precio_socio"?: number | null,"producto_id"?: string,"responsable"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "eventos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_gimnasio_id_producto_id_fkey"
      columns: ["gimnasio_id","producto_id"]
isOneToOne: true
      referencedRelation: "productos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"eventos_webhook": {
                  Row: {
                    "error": string | null,"gimnasio_id": string | null,"id": string,"id_externo": string,"intentos": number,"origen": string,"payload": NonNullable<Json>,"procesado_en": string | null,"recibido_en": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"gimnasio_id"?: string | null,"id"?: string,"id_externo": string,"intentos"?: number,"origen": string,"payload"?: NonNullable<Json>,"procesado_en"?: string | null,"recibido_en"?: string,"tipo": string
                  }
                  Update: {
                    "error"?: string | null,"gimnasio_id"?: string | null,"id"?: string,"id_externo"?: string,"intentos"?: number,"origen"?: string,"payload"?: NonNullable<Json>,"procesado_en"?: string | null,"recibido_en"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_webhook_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"faltas_perdonadas": {
                  Row: {
                    "clase_id": string,"creado_en": string,"gimnasio_id": string,"id": string,"motivo": string,"perdonado_por": string,"reserva_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clase_id": string,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"motivo": string,"perdonado_por": string,"reserva_id": string,"socio_id": string
                  }
                  Update: {
                    "clase_id"?: string,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"perdonado_por"?: string,"reserva_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "faltas_perdonadas_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "faltas_perdonadas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "faltas_perdonadas_gimnasio_id_perdonado_por_fkey"
      columns: ["gimnasio_id","perdonado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "faltas_perdonadas_gimnasio_id_reserva_id_fkey"
      columns: ["gimnasio_id","reserva_id"]
isOneToOne: true
      referencedRelation: "reservas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "faltas_perdonadas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"favoritos_brik": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favoritos_brik_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"fichajes": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"anulado_por": string | null,"cierre": string | null,"entrada_en": string,"equipo_id": string,"gimnasio_id": string,"id": string,"salida_en": string | null,"sede_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"cierre"?: string | null,"entrada_en"?: string,"equipo_id": string,"gimnasio_id": string,"id"?: string,"salida_en"?: string | null,"sede_id"?: string | null
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"cierre"?: string | null,"entrada_en"?: string,"equipo_id"?: string,"gimnasio_id"?: string,"id"?: string,"salida_en"?: string | null,"sede_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fichajes_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "fichajes_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "fichajes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fichajes_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"firmas_documento": {
                  Row: {
                    "documento_id": string,"firmado_en": string,"gimnasio_id": string,"id": string,"nombre": string,"registrado_por": string | null,"socio_id": string,"via": string
                  }
                  ComputedFields: never
                  Insert: {
                    "documento_id": string,"firmado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string,"registrado_por"?: string | null,"socio_id": string,"via": string
                  }
                  Update: {
                    "documento_id"?: string,"firmado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"registrado_por"?: string | null,"socio_id"?: string,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "firmas_documento_gimnasio_id_documento_id_fkey"
      columns: ["gimnasio_id","documento_id"]
isOneToOne: false
      referencedRelation: "documentos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "firmas_documento_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "firmas_documento_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "firmas_documento_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"firmas_propias_documento": {
                  Row: {
                    "documento_id": string,"firmado_en": string,"gimnasio_id": string,"id": string,"nombre": string,"registrado_por": string | null,"socio_id": string,"via": string
                  }
                  ComputedFields: never
                  Insert: {
                    "documento_id": string,"firmado_en"?: string,"gimnasio_id": string,"id"?: string,"nombre": string,"registrado_por"?: string | null,"socio_id": string,"via": string
                  }
                  Update: {
                    "documento_id"?: string,"firmado_en"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"registrado_por"?: string | null,"socio_id"?: string,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "firmas_propias_documento_gimnasio_id_documento_id_fkey"
      columns: ["gimnasio_id","documento_id"]
isOneToOne: false
      referencedRelation: "documentos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "firmas_propias_documento_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "firmas_propias_documento_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "firmas_propias_documento_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"funciones_gimnasio": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"actualizado_por": string | null,"clave": string,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"actualizado_por"?: string | null,"clave": string,"gimnasio_id": string
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"actualizado_por"?: string | null,"clave"?: string,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funciones_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"funciones_nuevas_gimnasio": {
                  Row: {
                    "activa": boolean,"cambiada_en": string,"cambiada_por": string | null,"clave": string,"gimnasio_id": string,"id": string,"prendida_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"cambiada_en"?: string,"cambiada_por"?: string | null,"clave": string,"gimnasio_id": string,"id"?: string,"prendida_en"?: string | null
                  }
                  Update: {
                    "activa"?: boolean,"cambiada_en"?: string,"cambiada_por"?: string | null,"clave"?: string,"gimnasio_id"?: string,"id"?: string,"prendida_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "funciones_nuevas_gimnasio_gimnasio_id_cambiada_por_fkey"
      columns: ["gimnasio_id","cambiada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "funciones_nuevas_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"funciones_prueba": {
                  Row: {
                    "clave": string,"creado_en": string,"gimnasio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"creado_en"?: string,"gimnasio_id": string
                  }
                  Update: {
                    "clave"?: string,"creado_en"?: string,"gimnasio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "funciones_prueba_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"gastos": {
                  Row: {
                    "anulado_en": string | null,"anulado_por": string | null,"categoria": string,"comprobante_path": string | null,"creado_en": string,"creado_por": string,"detalle": string | null,"fecha": string,"gimnasio_id": string,"id": string,"mes": string,"monto": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_por"?: string | null,"categoria": string,"comprobante_path"?: string | null,"creado_en"?: string,"creado_por": string,"detalle"?: string | null,"fecha": string,"gimnasio_id": string,"id"?: string,"mes": string,"monto": number
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_por"?: string | null,"categoria"?: string,"comprobante_path"?: string | null,"creado_en"?: string,"creado_por"?: string,"detalle"?: string | null,"fecha"?: string,"gimnasio_id"?: string,"id"?: string,"mes"?: string,"monto"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gastos_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "gastos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "gastos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"gastos_fijos": {
                  Row: {
                    "anulado_en": string | null,"anulado_por": string | null,"categoria": string,"creado_en": string,"creado_por": string,"desde": string,"detalle": string | null,"gimnasio_id": string,"hasta": string | null,"id": string,"monto": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_por"?: string | null,"categoria": string,"creado_en"?: string,"creado_por": string,"desde": string,"detalle"?: string | null,"gimnasio_id": string,"hasta"?: string | null,"id"?: string,"monto": number
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_por"?: string | null,"categoria"?: string,"creado_en"?: string,"creado_por"?: string,"desde"?: string,"detalle"?: string | null,"gimnasio_id"?: string,"hasta"?: string | null,"id"?: string,"monto"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gastos_fijos_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "gastos_fijos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "gastos_fijos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"gimnasios": {
                  Row: {
                    "baja_en": string | null,"baja_motivo": string | null,"borrado_en": string | null,"creado_en": string,"demo_hasta": string | null,"demo_para": string | null,"es_demo": boolean,"id": string,"moneda": string,"nombre": string,"origen": string,"plataforma_desde": string | null,"plataforma_plan_id": string | null,"prueba_dias": number,"slug": string,"suspension_manual_en": string | null,"suspension_manual_motivo": string | null,"tipo_plantilla": string | null,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "baja_en"?: string | null,"baja_motivo"?: string | null,"borrado_en"?: string | null,"creado_en"?: string,"demo_hasta"?: string | null,"demo_para"?: string | null,"es_demo"?: boolean,"id"?: string,"moneda"?: string,"nombre": string,"origen"?: string,"plataforma_desde"?: string | null,"plataforma_plan_id"?: string | null,"prueba_dias"?: number,"slug": string,"suspension_manual_en"?: string | null,"suspension_manual_motivo"?: string | null,"tipo_plantilla"?: string | null,"zona_horaria"?: string
                  }
                  Update: {
                    "baja_en"?: string | null,"baja_motivo"?: string | null,"borrado_en"?: string | null,"creado_en"?: string,"demo_hasta"?: string | null,"demo_para"?: string | null,"es_demo"?: boolean,"id"?: string,"moneda"?: string,"nombre"?: string,"origen"?: string,"plataforma_desde"?: string | null,"plataforma_plan_id"?: string | null,"prueba_dias"?: number,"slug"?: string,"suspension_manual_en"?: string | null,"suspension_manual_motivo"?: string | null,"tipo_plantilla"?: string | null,"zona_horaria"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gimnasios_plataforma_plan_id_fkey"
      columns: ["plataforma_plan_id"]
isOneToOne: false
      referencedRelation: "plataforma_planes"
      referencedColumns: ["id"]
    }
                  ]
                },"grados": {
                  Row: {
                    "actividad_id": string,"activo": boolean,"clases_minimas": number,"color": string | null,"creado_en": string,"gimnasio_id": string,"id": string,"meses_minimos": number,"nombre": string,"orden": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"activo"?: boolean,"clases_minimas"?: number,"color"?: string | null,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"meses_minimos"?: number,"nombre": string,"orden": number
                  }
                  Update: {
                    "actividad_id"?: string,"activo"?: boolean,"clases_minimas"?: number,"color"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"meses_minimos"?: number,"nombre"?: string,"orden"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "grados_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "grados_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"grados_socio": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"anulado_por": string | null,"creado_en": string,"gimnasio_id": string,"grado_id": string,"id": string,"otorgado_en": string,"otorgado_por": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"creado_en"?: string,"gimnasio_id": string,"grado_id": string,"id"?: string,"otorgado_en"?: string,"otorgado_por": string,"socio_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"creado_en"?: string,"gimnasio_id"?: string,"grado_id"?: string,"id"?: string,"otorgado_en"?: string,"otorgado_por"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grados_socio_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "grados_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grados_socio_gimnasio_id_grado_id_fkey"
      columns: ["gimnasio_id","grado_id"]
isOneToOne: false
      referencedRelation: "grados"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "grados_socio_gimnasio_id_otorgado_por_fkey"
      columns: ["gimnasio_id","otorgado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "grados_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"grupos_familiares": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"tipo": string,"titular_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"tipo"?: string,"titular_id"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"tipo"?: string,"titular_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "grupos_familiares_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grupos_familiares_titular_fk"
      columns: ["gimnasio_id","titular_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"hilos_socio": {
                  Row: {
                    "creado_en": string,"estado": string,"gimnasio_id": string,"id": string,"motivo": string,"resuelto_en": string | null,"resuelto_por": string | null,"socio_id": string,"socio_leyo_en": string | null,"ultimo_autor": string,"ultimo_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"estado"?: string,"gimnasio_id": string,"id"?: string,"motivo": string,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id": string,"socio_leyo_en"?: string | null,"ultimo_autor"?: string,"ultimo_en"?: string
                  }
                  Update: {
                    "creado_en"?: string,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id"?: string,"socio_leyo_en"?: string | null,"ultimo_autor"?: string,"ultimo_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hilos_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hilos_socio_gimnasio_id_resuelto_por_fkey"
      columns: ["gimnasio_id","resuelto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "hilos_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"historial_bajas": {
                  Row: {
                    "dado_de_baja_en": string,"gimnasio_id": string,"id": string,"motivo": string | null,"socio_id": string,"volvio_en": string,"volvio_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "dado_de_baja_en": string,"gimnasio_id": string,"id"?: string,"motivo"?: string | null,"socio_id": string,"volvio_en"?: string,"volvio_por"?: string | null
                  }
                  Update: {
                    "dado_de_baja_en"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string | null,"socio_id"?: string,"volvio_en"?: string,"volvio_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historial_bajas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "historial_bajas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"historial_configuracion": {
                  Row: {
                    "antes": Json | null,"cambiado_en": string,"campo": string,"despues": Json | null,"equipo_id": string | null,"gimnasio_id": string,"id": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "antes"?: Json | null,"cambiado_en"?: string,"campo": string,"despues"?: Json | null,"equipo_id"?: string | null,"gimnasio_id": string,"id"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "antes"?: Json | null,"cambiado_en"?: string,"campo"?: string,"despues"?: Json | null,"equipo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "historial_configuracion_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "historial_configuracion_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"horarios_apertura": {
                  Row: {
                    "abre": string,"cierra": string,"creado_en": string,"dia": number,"gimnasio_id": string,"id": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abre": string,"cierra": string,"creado_en"?: string,"dia": number,"gimnasio_id": string,"id"?: string,"sede_id": string
                  }
                  Update: {
                    "abre"?: string,"cierra"?: string,"creado_en"?: string,"dia"?: number,"gimnasio_id"?: string,"id"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_apertura_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_apertura_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"horarios_clase": {
                  Row: {
                    "actividad_id": string,"creado_en": string,"cupo": number | null,"dia_semana": number,"duracion_min": number,"gimnasio_id": string,"hora_inicio": string,"id": string,"profe_id": string | null,"sede_id": string,"vigente_desde": string,"vigente_hasta": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"creado_en"?: string,"cupo"?: number | null,"dia_semana": number,"duracion_min": number,"gimnasio_id": string,"hora_inicio": string,"id"?: string,"profe_id"?: string | null,"sede_id": string,"vigente_desde"?: string,"vigente_hasta"?: string | null
                  }
                  Update: {
                    "actividad_id"?: string,"creado_en"?: string,"cupo"?: number | null,"dia_semana"?: number,"duracion_min"?: number,"gimnasio_id"?: string,"hora_inicio"?: string,"id"?: string,"profe_id"?: string | null,"sede_id"?: string,"vigente_desde"?: string,"vigente_hasta"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "horarios_clase_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "horarios_clase_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horarios_clase_gimnasio_id_profe_id_fkey"
      columns: ["gimnasio_id","profe_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "horarios_clase_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"horas_profe": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"anulado_por": string | null,"creado_en": string,"creado_por": string,"fecha": string,"gimnasio_id": string,"id": string,"minutos": number,"nota": string | null,"profe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"creado_en"?: string,"creado_por": string,"fecha": string,"gimnasio_id": string,"id"?: string,"minutos": number,"nota"?: string | null,"profe_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"creado_en"?: string,"creado_por"?: string,"fecha"?: string,"gimnasio_id"?: string,"id"?: string,"minutos"?: number,"nota"?: string | null,"profe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "horas_profe_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "horas_profe_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "horas_profe_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "horas_profe_gimnasio_id_profe_id_fkey"
      columns: ["gimnasio_id","profe_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"huellas_brik": {
                  Row: {
                    "huella": string,"primera_vez": string,"ultima_vez": string,"user_agent": string | null,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "huella": string,"primera_vez"?: string,"ultima_vez"?: string,"user_agent"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "huella"?: string,"primera_vez"?: string,"ultima_vez"?: string,"user_agent"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"huellas_equipo": {
                  Row: {
                    "equipo_id": string,"gimnasio_id": string,"huella": string,"primera_vez": string,"ultima_vez": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "equipo_id": string,"gimnasio_id": string,"huella": string,"primera_vez"?: string,"ultima_vez"?: string,"user_agent"?: string | null
                  }
                  Update: {
                    "equipo_id"?: string,"gimnasio_id"?: string,"huella"?: string,"primera_vez"?: string,"ultima_vez"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "huellas_equipo_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "huellas_equipo_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"importaciones": {
                  Row: {
                    "archivo": string | null,"creado_en": string,"creado_por": string | null,"deshecha_en": string | null,"deshecha_por": string | null,"filas": number,"gimnasio_id": string,"id": string,"importados": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archivo"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"deshecha_en"?: string | null,"deshecha_por"?: string | null,"filas": number,"gimnasio_id": string,"id"?: string,"importados": number
                  }
                  Update: {
                    "archivo"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"deshecha_en"?: string | null,"deshecha_por"?: string | null,"filas"?: number,"gimnasio_id"?: string,"id"?: string,"importados"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "importaciones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"incidentes": {
                  Row: {
                    "corregido_en": string | null,"creado_en": string,"creado_por": string,"donde": string,"gimnasio_id": string,"id": string,"ocurrio_en": string,"que_paso": string,"que_se_hizo": string,"socio_id": string | null,"testigos": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "corregido_en"?: string | null,"creado_en"?: string,"creado_por": string,"donde": string,"gimnasio_id": string,"id"?: string,"ocurrio_en"?: string,"que_paso": string,"que_se_hizo": string,"socio_id"?: string | null,"testigos"?: string | null
                  }
                  Update: {
                    "corregido_en"?: string | null,"creado_en"?: string,"creado_por"?: string,"donde"?: string,"gimnasio_id"?: string,"id"?: string,"ocurrio_en"?: string,"que_paso"?: string,"que_se_hizo"?: string,"socio_id"?: string | null,"testigos"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidentes_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "incidentes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidentes_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"ingresos": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"anulado_por": string | null,"color": string,"creado_en": string,"dispositivo_id": string | null,"emergencia_id": string | null,"forzado_motivo": string | null,"gimnasio_id": string,"id": string,"momento": string,"motivo": string,"registrado_por": string | null,"resultado": string,"sede_id": string,"socio_id": string,"texto": string,"via_acceso": string,"via_habilitante": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"color": string,"creado_en"?: string,"dispositivo_id"?: string | null,"emergencia_id"?: string | null,"forzado_motivo"?: string | null,"gimnasio_id": string,"id"?: string,"momento"?: string,"motivo": string,"registrado_por"?: string | null,"resultado": string,"sede_id": string,"socio_id": string,"texto": string,"via_acceso": string,"via_habilitante"?: string | null
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"color"?: string,"creado_en"?: string,"dispositivo_id"?: string | null,"emergencia_id"?: string | null,"forzado_motivo"?: string | null,"gimnasio_id"?: string,"id"?: string,"momento"?: string,"motivo"?: string,"registrado_por"?: string | null,"resultado"?: string,"sede_id"?: string,"socio_id"?: string,"texto"?: string,"via_acceso"?: string,"via_habilitante"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingresos_emergencia_fk"
      columns: ["gimnasio_id","emergencia_id"]
isOneToOne: false
      referencedRelation: "emergencias_puerta"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_dispositivo_id_fkey"
      columns: ["gimnasio_id","dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"ingresos_sin_internet": {
                  Row: {
                    "anotado_en": string,"gimnasio_id": string,"id": string,"id_local": string,"ingreso_id": string,"registrado_por": string,"sincronizado_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anotado_en": string,"gimnasio_id": string,"id"?: string,"id_local": string,"ingreso_id": string,"registrado_por": string,"sincronizado_en"?: string
                  }
                  Update: {
                    "anotado_en"?: string,"gimnasio_id"?: string,"id"?: string,"id_local"?: string,"ingreso_id"?: string,"registrado_por"?: string,"sincronizado_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingresos_sin_internet_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingresos_sin_internet_gimnasio_id_ingreso_id_fkey"
      columns: ["gimnasio_id","ingreso_id"]
isOneToOne: false
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ingresos_sin_internet_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"intentos_ingreso_fallidos": {
                  Row: {
                    "creado_en": string,"destino_hash": string,"id": string,"ip": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"destino_hash": string,"id"?: string,"ip"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"destino_hash"?: string,"id"?: string,"ip"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"invitados": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"creado_en": string,"creado_por": string | null,"desde_la_app": boolean,"dni": string,"entro_en": string | null,"gimnasio_id": string,"id": string,"nombre": string,"para_el_dia": string,"sede_id": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"desde_la_app"?: boolean,"dni": string,"entro_en"?: string | null,"gimnasio_id": string,"id"?: string,"nombre": string,"para_el_dia": string,"sede_id"?: string | null,"socio_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"desde_la_app"?: boolean,"dni"?: string,"entro_en"?: string | null,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"para_el_dia"?: string,"sede_id"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitados_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitados_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "invitados_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"landing_gimnasio": {
                  Row: {
                    "actualizado_en": string,"bajada": string | null,"boton_texto": string,"email_contacto": string | null,"foto_portada_path": string | null,"gimnasio_id": string,"google_analytics": string | null,"instagram": string | null,"mensaje_whatsapp": string,"mostrar_precios": boolean,"mostrar_socios": boolean,"pixel_meta": string | null,"publicada": boolean,"resena_cantidad": number | null,"resena_puntaje": number | null,"tipografia": string,"titulo": string,"video_portada_url": string | null,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"bajada"?: string | null,"boton_texto"?: string,"email_contacto"?: string | null,"foto_portada_path"?: string | null,"gimnasio_id": string,"google_analytics"?: string | null,"instagram"?: string | null,"mensaje_whatsapp"?: string,"mostrar_precios"?: boolean,"mostrar_socios"?: boolean,"pixel_meta"?: string | null,"publicada"?: boolean,"resena_cantidad"?: number | null,"resena_puntaje"?: number | null,"tipografia"?: string,"titulo": string,"video_portada_url"?: string | null,"whatsapp"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"bajada"?: string | null,"boton_texto"?: string,"email_contacto"?: string | null,"foto_portada_path"?: string | null,"gimnasio_id"?: string,"google_analytics"?: string | null,"instagram"?: string | null,"mensaje_whatsapp"?: string,"mostrar_precios"?: boolean,"mostrar_socios"?: boolean,"pixel_meta"?: string | null,"publicada"?: boolean,"resena_cantidad"?: number | null,"resena_puntaje"?: number | null,"tipografia"?: string,"titulo"?: string,"video_portada_url"?: string | null,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "landing_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"landing_secciones": {
                  Row: {
                    "actualizado_en": string,"contenido": NonNullable<Json>,"gimnasio_id": string,"id": string,"orden": number,"tipo": string,"titulo": string,"visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"contenido"?: NonNullable<Json>,"gimnasio_id": string,"id"?: string,"orden"?: number,"tipo": string,"titulo": string,"visible"?: boolean
                  }
                  Update: {
                    "actualizado_en"?: string,"contenido"?: NonNullable<Json>,"gimnasio_id"?: string,"id"?: string,"orden"?: number,"tipo"?: string,"titulo"?: string,"visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "landing_secciones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"lockers": {
                  Row: {
                    "activo": boolean,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"numero": string,"sede_id": string,"ubicacion": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"numero": string,"sede_id": string,"ubicacion"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"numero"?: string,"sede_id"?: string,"ubicacion"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lockers_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "lockers_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lockers_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"lugares_sala": {
                  Row: {
                    "actividad_id": string,"actualizado_en": string,"cantidad": number,"etiqueta": string,"fuera_servicio": (number)[],"gimnasio_id": string,"id": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"actualizado_en"?: string,"cantidad": number,"etiqueta"?: string,"fuera_servicio"?: (number)[],"gimnasio_id": string,"id"?: string,"sede_id": string
                  }
                  Update: {
                    "actividad_id"?: string,"actualizado_en"?: string,"cantidad"?: number,"etiqueta"?: string,"fuera_servicio"?: (number)[],"gimnasio_id"?: string,"id"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lugares_sala_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "lugares_sala_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lugares_sala_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"maquina_fallas": {
                  Row: {
                    "arreglada_en": string | null,"arreglada_por": string | null,"asignada_en": string | null,"asignada_por": string | null,"foto_path": string | null,"gimnasio_id": string,"id": string,"maquina_id": string,"motivo": string,"nota_arreglo": string | null,"reportada_en": string,"reportada_por": string,"responsable_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arreglada_en"?: string | null,"arreglada_por"?: string | null,"asignada_en"?: string | null,"asignada_por"?: string | null,"foto_path"?: string | null,"gimnasio_id": string,"id"?: string,"maquina_id": string,"motivo": string,"nota_arreglo"?: string | null,"reportada_en"?: string,"reportada_por": string,"responsable_id"?: string | null
                  }
                  Update: {
                    "arreglada_en"?: string | null,"arreglada_por"?: string | null,"asignada_en"?: string | null,"asignada_por"?: string | null,"foto_path"?: string | null,"gimnasio_id"?: string,"id"?: string,"maquina_id"?: string,"motivo"?: string,"nota_arreglo"?: string | null,"reportada_en"?: string,"reportada_por"?: string,"responsable_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "maquina_fallas_gimnasio_id_arreglada_por_fkey"
      columns: ["gimnasio_id","arreglada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "maquina_fallas_gimnasio_id_asignada_por_fkey"
      columns: ["gimnasio_id","asignada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "maquina_fallas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maquina_fallas_gimnasio_id_maquina_id_fkey"
      columns: ["gimnasio_id","maquina_id"]
isOneToOne: false
      referencedRelation: "maquinas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "maquina_fallas_gimnasio_id_reportada_por_fkey"
      columns: ["gimnasio_id","reportada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "maquina_fallas_gimnasio_id_responsable_id_fkey"
      columns: ["gimnasio_id","responsable_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"maquinas": {
                  Row: {
                    "activa": boolean,"creada_en": string,"creada_por": string,"gimnasio_id": string,"id": string,"nombre": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"creada_en"?: string,"creada_por": string,"gimnasio_id": string,"id"?: string,"nombre": string,"sede_id": string
                  }
                  Update: {
                    "activa"?: boolean,"creada_en"?: string,"creada_por"?: string,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maquinas_gimnasio_id_creada_por_fkey"
      columns: ["gimnasio_id","creada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "maquinas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maquinas_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"mensajes_socio": {
                  Row: {
                    "autor": string,"creado_en": string,"equipo_id": string | null,"foto_path": string | null,"gimnasio_id": string,"hilo_id": string,"id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor": string,"creado_en"?: string,"equipo_id"?: string | null,"foto_path"?: string | null,"gimnasio_id": string,"hilo_id": string,"id"?: string,"texto": string
                  }
                  Update: {
                    "autor"?: string,"creado_en"?: string,"equipo_id"?: string | null,"foto_path"?: string | null,"gimnasio_id"?: string,"hilo_id"?: string,"id"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mensajes_socio_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "mensajes_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensajes_socio_gimnasio_id_hilo_id_fkey"
      columns: ["gimnasio_id","hilo_id"]
isOneToOne: false
      referencedRelation: "hilos_socio"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"motivos_beneficio": {
                  Row: {
                    "activo": boolean,"creado_en": string,"creado_por": string | null,"gimnasio_id": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"creado_por"?: string | null,"gimnasio_id": string,"id"?: string,"nombre": string
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"creado_por"?: string | null,"gimnasio_id"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "motivos_beneficio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"movimientos_caja": {
                  Row: {
                    "creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"monto": number,"motivo": string,"ticket_path": string | null,"tipo": string,"turno_caja_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"monto": number,"motivo": string,"ticket_path"?: string | null,"tipo": string,"turno_caja_id": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"monto"?: number,"motivo"?: string,"ticket_path"?: string | null,"tipo"?: string,"turno_caja_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimientos_caja_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "movimientos_caja_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_caja_gimnasio_id_turno_caja_id_fkey"
      columns: ["gimnasio_id","turno_caja_id"]
isOneToOne: false
      referencedRelation: "turnos_caja"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"movimientos_stock": {
                  Row: {
                    "cantidad": number,"creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"motivo": string | null,"producto_id": string,"remito_path": string | null,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"motivo"?: string | null,"producto_id": string,"remito_path"?: string | null,"tipo": string
                  }
                  Update: {
                    "cantidad"?: number,"creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string | null,"producto_id"?: string,"remito_path"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimientos_stock_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "movimientos_stock_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_gimnasio_id_producto_id_fkey"
      columns: ["gimnasio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"no_escribirle_historial": {
                  Row: {
                    "gimnasio_id": string,"id": string,"levantado_en": string,"levantado_por": string,"marcado_en": string,"marcado_por": string | null,"motivo": string,"motivo_levantar": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gimnasio_id": string,"id"?: string,"levantado_en"?: string,"levantado_por": string,"marcado_en": string,"marcado_por"?: string | null,"motivo": string,"motivo_levantar": string,"socio_id": string
                  }
                  Update: {
                    "gimnasio_id"?: string,"id"?: string,"levantado_en"?: string,"levantado_por"?: string,"marcado_en"?: string,"marcado_por"?: string | null,"motivo"?: string,"motivo_levantar"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "no_escribirle_historial_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "no_escribirle_historial_gimnasio_id_levantado_por_fkey"
      columns: ["gimnasio_id","levantado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "no_escribirle_historial_gimnasio_id_marcado_por_fkey"
      columns: ["gimnasio_id","marcado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "no_escribirle_historial_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"notas_brik": {
                  Row: {
                    "autor_id": string,"creado_en": string,"gimnasio_id": string,"id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id": string,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"texto": string
                  }
                  Update: {
                    "autor_id"?: string,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notas_brik_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"notas_socio": {
                  Row: {
                    "borrada_en": string | null,"creado_en": string,"equipo_id": string | null,"gimnasio_id": string,"id": string,"socio_id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "borrada_en"?: string | null,"creado_en"?: string,"equipo_id"?: string | null,"gimnasio_id": string,"id"?: string,"socio_id": string,"texto": string
                  }
                  Update: {
                    "borrada_en"?: string | null,"creado_en"?: string,"equipo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"socio_id"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notas_socio_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "notas_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notas_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"novedades_gimnasio": {
                  Row: {
                    "creado_en": string,"creado_por": string,"desde": string,"gimnasio_id": string,"hasta": string,"id": string,"quitado_en": string | null,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"desde"?: string,"gimnasio_id": string,"hasta": string,"id"?: string,"quitado_en"?: string | null,"texto": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"quitado_en"?: string | null,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "novedades_gimnasio_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "novedades_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"novedades_plataforma": {
                  Row: {
                    "creado_en": string,"creado_por": string,"id": string,"link": string | null,"para_ciudad": string | null,"para_modulo": string | null,"para_plan": string | null,"retirada_en": string | null,"texto": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"id"?: string,"link"?: string | null,"para_ciudad"?: string | null,"para_modulo"?: string | null,"para_plan"?: string | null,"retirada_en"?: string | null,"texto": string,"titulo": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"id"?: string,"link"?: string | null,"para_ciudad"?: string | null,"para_modulo"?: string | null,"para_plan"?: string | null,"retirada_en"?: string | null,"texto"?: string,"titulo"?: string
                  }
                  Relationships: [
                    
                  ]
                },"novedades_plataforma_cerradas": {
                  Row: {
                    "cerrada_en": string,"equipo_id": string,"gimnasio_id": string,"id": string,"novedad_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cerrada_en"?: string,"equipo_id": string,"gimnasio_id": string,"id"?: string,"novedad_id": string
                  }
                  Update: {
                    "cerrada_en"?: string,"equipo_id"?: string,"gimnasio_id"?: string,"id"?: string,"novedad_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "novedades_plataforma_cerradas_gimnasio_id_equipo_id_fkey"
      columns: ["gimnasio_id","equipo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "novedades_plataforma_cerradas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "novedades_plataforma_cerradas_novedad_id_fkey"
      columns: ["novedad_id"]
isOneToOne: false
      referencedRelation: "novedades_plataforma"
      referencedColumns: ["id"]
    }
                  ]
                },"origenes_alta": {
                  Row: {
                    "canal": string,"creado_en": string,"gimnasio_id": string,"id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canal": string,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"socio_id": string
                  }
                  Update: {
                    "canal"?: string,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "origenes_alta_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "origenes_alta_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: true
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"packs": {
                  Row: {
                    "anulado_en": string | null,"cantidad": number,"creado_en": string,"desde": string,"gimnasio_id": string,"id": string,"plan_id": string,"socio_id": string,"vence_en": string | null,"venta_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"cantidad": number,"creado_en"?: string,"desde": string,"gimnasio_id": string,"id"?: string,"plan_id": string,"socio_id": string,"vence_en"?: string | null,"venta_item_id"?: string | null
                  }
                  Update: {
                    "anulado_en"?: string | null,"cantidad"?: number,"creado_en"?: string,"desde"?: string,"gimnasio_id"?: string,"id"?: string,"plan_id"?: string,"socio_id"?: string,"vence_en"?: string | null,"venta_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "packs_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "packs_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "packs_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "packs_gimnasio_id_venta_item_id_fkey"
      columns: ["gimnasio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pagos": {
                  Row: {
                    "aprobado_en": string | null,"aprobado_por": string | null,"cargado_despues_en": string | null,"cargado_despues_por": string | null,"cobro_tarde_en": string | null,"cobro_tarde_mp_id": string | null,"comprobante_path": string | null,"creado_en": string,"creado_por": string | null,"devuelto_en": string | null,"devuelto_motivo": string | null,"estado": string,"gimnasio_id": string,"id": string,"medio": string,"monto": number,"mp_evento_en": string | null,"mp_pago_id": string | null,"mp_reembolsado": number | null,"mp_revisado_en": string | null,"rechazado_en": string | null,"rechazado_motivo": string | null,"rechazado_por": string | null,"turno_caja_id": string | null,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aprobado_en"?: string | null,"aprobado_por"?: string | null,"cargado_despues_en"?: string | null,"cargado_despues_por"?: string | null,"cobro_tarde_en"?: string | null,"cobro_tarde_mp_id"?: string | null,"comprobante_path"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"devuelto_en"?: string | null,"devuelto_motivo"?: string | null,"estado": string,"gimnasio_id": string,"id"?: string,"medio": string,"monto": number,"mp_evento_en"?: string | null,"mp_pago_id"?: string | null,"mp_reembolsado"?: number | null,"mp_revisado_en"?: string | null,"rechazado_en"?: string | null,"rechazado_motivo"?: string | null,"rechazado_por"?: string | null,"turno_caja_id"?: string | null,"venta_id": string
                  }
                  Update: {
                    "aprobado_en"?: string | null,"aprobado_por"?: string | null,"cargado_despues_en"?: string | null,"cargado_despues_por"?: string | null,"cobro_tarde_en"?: string | null,"cobro_tarde_mp_id"?: string | null,"comprobante_path"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"devuelto_en"?: string | null,"devuelto_motivo"?: string | null,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"medio"?: string,"monto"?: number,"mp_evento_en"?: string | null,"mp_pago_id"?: string | null,"mp_reembolsado"?: number | null,"mp_revisado_en"?: string | null,"rechazado_en"?: string | null,"rechazado_motivo"?: string | null,"rechazado_por"?: string | null,"turno_caja_id"?: string | null,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagos_cargado_por_fk"
      columns: ["gimnasio_id","cargado_despues_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_gimnasio_id_aprobado_por_fkey"
      columns: ["gimnasio_id","aprobado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_gimnasio_id_turno_caja_id_fkey"
      columns: ["gimnasio_id","turno_caja_id"]
isOneToOne: false
      referencedRelation: "turnos_caja"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_rechazado_por_fk"
      columns: ["gimnasio_id","rechazado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pagos_profe": {
                  Row: {
                    "anulado_en": string | null,"anulado_motivo": string | null,"anulado_por": string | null,"clave": string | null,"gimnasio_id": string,"id": string,"medio": string,"mes": string,"monto": number,"movimiento_caja_id": string | null,"nota": string | null,"pagado_en": string,"pagado_por": string,"profe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"clave"?: string | null,"gimnasio_id": string,"id"?: string,"medio": string,"mes": string,"monto": number,"movimiento_caja_id"?: string | null,"nota"?: string | null,"pagado_en"?: string,"pagado_por": string,"profe_id": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"anulado_motivo"?: string | null,"anulado_por"?: string | null,"clave"?: string | null,"gimnasio_id"?: string,"id"?: string,"medio"?: string,"mes"?: string,"monto"?: number,"movimiento_caja_id"?: string | null,"nota"?: string | null,"pagado_en"?: string,"pagado_por"?: string,"profe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagos_profe_gimnasio_id_anulado_por_fkey"
      columns: ["gimnasio_id","anulado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_profe_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_profe_gimnasio_id_movimiento_caja_id_fkey"
      columns: ["gimnasio_id","movimiento_caja_id"]
isOneToOne: false
      referencedRelation: "movimientos_caja"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_profe_gimnasio_id_pagado_por_fkey"
      columns: ["gimnasio_id","pagado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_profe_gimnasio_id_profe_id_fkey"
      columns: ["gimnasio_id","profe_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pagos_vistos_en_banco": {
                  Row: {
                    "gimnasio_id": string,"id": string,"pago_id": string,"visto_en": string,"visto_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gimnasio_id": string,"id"?: string,"pago_id": string,"visto_en"?: string,"visto_por": string
                  }
                  Update: {
                    "gimnasio_id"?: string,"id"?: string,"pago_id"?: string,"visto_en"?: string,"visto_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagos_vistos_en_banco_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_vistos_en_banco_gimnasio_id_pago_id_fkey"
      columns: ["gimnasio_id","pago_id"]
isOneToOne: true
      referencedRelation: "pagos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pagos_vistos_en_banco_gimnasio_id_visto_por_fkey"
      columns: ["gimnasio_id","visto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pantallas_tv": {
                  Row: {
                    "creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"modo": string,"nombre": string,"revocada_en": string | null,"sede_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"modo"?: string,"nombre": string,"revocada_en"?: string | null,"sede_id": string,"token_hash": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"modo"?: string,"nombre"?: string,"revocada_en"?: string | null,"sede_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pantallas_tv_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pantallas_tv_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pantallas_tv_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pases_diarios": {
                  Row: {
                    "anulado_en": string | null,"creado_en": string,"desde": string,"gimnasio_id": string,"hasta": string,"id": string,"plan_id": string | null,"sede_id": string | null,"socio_id": string,"usado_en_ingreso_id": string | null,"venta_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"creado_en"?: string,"desde": string,"gimnasio_id": string,"hasta": string,"id"?: string,"plan_id"?: string | null,"sede_id"?: string | null,"socio_id": string,"usado_en_ingreso_id"?: string | null,"venta_item_id"?: string | null
                  }
                  Update: {
                    "anulado_en"?: string | null,"creado_en"?: string,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"plan_id"?: string | null,"sede_id"?: string | null,"socio_id"?: string,"usado_en_ingreso_id"?: string | null,"venta_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pases_diarios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pases_diarios_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pases_diarios_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pases_diarios_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pases_diarios_gimnasio_id_venta_item_id_fkey"
      columns: ["gimnasio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pases_diarios_ingreso_fk"
      columns: ["gimnasio_id","usado_en_ingreso_id"]
isOneToOne: false
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pedidos_anulacion": {
                  Row: {
                    "estado": string,"gimnasio_id": string,"id": string,"motivo": string,"pedido_en": string,"pedido_por": string,"respuesta": string | null,"resuelto_en": string | null,"resuelto_por": string | null,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "estado"?: string,"gimnasio_id": string,"id"?: string,"motivo": string,"pedido_en"?: string,"pedido_por": string,"respuesta"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"venta_id": string
                  }
                  Update: {
                    "estado"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"pedido_en"?: string,"pedido_por"?: string,"respuesta"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_anulacion_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_anulacion_gimnasio_id_pedido_por_fkey"
      columns: ["gimnasio_id","pedido_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_anulacion_gimnasio_id_resuelto_por_fkey"
      columns: ["gimnasio_id","resuelto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_anulacion_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pedidos_baja": {
                  Row: {
                    "codigo": string,"estado": string,"gimnasio_id": string,"id": string,"motivo": string,"nota": string | null,"pedido_en": string,"pedido_por": string,"resuelto_en": string | null,"resuelto_por": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codigo"?: string,"estado"?: string,"gimnasio_id": string,"id"?: string,"motivo": string,"nota"?: string | null,"pedido_en"?: string,"pedido_por": string,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id": string
                  }
                  Update: {
                    "codigo"?: string,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"nota"?: string | null,"pedido_en"?: string,"pedido_por"?: string,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_baja_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_baja_gimnasio_id_resuelto_por_fkey"
      columns: ["gimnasio_id","resuelto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_baja_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pedidos_codigo": {
                  Row: {
                    "creado_en": string,"destino_hash": string,"id": string,"ip": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"destino_hash": string,"id"?: string,"ip"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"destino_hash"?: string,"id"?: string,"ip"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"pedidos_datos": {
                  Row: {
                    "creado_en": string,"detalle": string | null,"gimnasio_id": string,"id": string,"nota_resolucion": string | null,"resuelto_en": string | null,"resuelto_por": string | null,"socio_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"detalle"?: string | null,"gimnasio_id": string,"id"?: string,"nota_resolucion"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id": string,"tipo": string
                  }
                  Update: {
                    "creado_en"?: string,"detalle"?: string | null,"gimnasio_id"?: string,"id"?: string,"nota_resolucion"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_datos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_datos_gimnasio_id_resuelto_por_fkey"
      columns: ["gimnasio_id","resuelto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_datos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pedidos_demo_brik": {
                  Row: {
                    "atendido_en": string | null,"atendido_por": string | null,"contacto": string,"creado_en": string,"gimnasio": string | null,"id": string,"mensaje": string | null,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "atendido_en"?: string | null,"atendido_por"?: string | null,"contacto": string,"creado_en"?: string,"gimnasio"?: string | null,"id"?: string,"mensaje"?: string | null,"nombre": string
                  }
                  Update: {
                    "atendido_en"?: string | null,"atendido_por"?: string | null,"contacto"?: string,"creado_en"?: string,"gimnasio"?: string | null,"id"?: string,"mensaje"?: string | null,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pedidos_pausa": {
                  Row: {
                    "autoaprobado": boolean,"categoria": string,"congelamiento_id": string | null,"desde": string,"estado": string,"gimnasio_id": string,"hasta": string,"id": string,"nota": string | null,"pedido_en": string,"pedido_por": string | null,"resuelto_en": string | null,"resuelto_por": string | null,"socio_id": string,"suscripcion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autoaprobado"?: boolean,"categoria": string,"congelamiento_id"?: string | null,"desde": string,"estado"?: string,"gimnasio_id": string,"hasta": string,"id"?: string,"nota"?: string | null,"pedido_en"?: string,"pedido_por"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id": string,"suscripcion_id": string
                  }
                  Update: {
                    "autoaprobado"?: boolean,"categoria"?: string,"congelamiento_id"?: string | null,"desde"?: string,"estado"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"nota"?: string | null,"pedido_en"?: string,"pedido_por"?: string | null,"resuelto_en"?: string | null,"resuelto_por"?: string | null,"socio_id"?: string,"suscripcion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_pausa_gimnasio_id_congelamiento_id_fkey"
      columns: ["gimnasio_id","congelamiento_id"]
isOneToOne: false
      referencedRelation: "congelamientos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_pausa_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_pausa_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pedidos_pausa_gimnasio_id_suscripcion_id_fkey"
      columns: ["gimnasio_id","suscripcion_id"]
isOneToOne: false
      referencedRelation: "suscripciones"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"plan_actividades": {
                  Row: {
                    "actividad_id": string,"gimnasio_id": string,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id": string,"gimnasio_id": string,"plan_id": string
                  }
                  Update: {
                    "actividad_id"?: string,"gimnasio_id"?: string,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_actividades_gimnasio_id_actividad_id_fkey"
      columns: ["gimnasio_id","actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "plan_actividades_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_actividades_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"plan_sedes": {
                  Row: {
                    "gimnasio_id": string,"plan_id": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gimnasio_id": string,"plan_id": string,"sede_id": string
                  }
                  Update: {
                    "gimnasio_id"?: string,"plan_id"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_sedes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_sedes_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "plan_sedes_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"planes": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"actualizado_por": string | null,"cantidad_clases": number | null,"consume_en": string | null,"creado_en": string,"descripcion": string | null,"dia_fijo": number | null,"duracion_meses": number | null,"gimnasio_id": string,"hora_desde": string | null,"hora_hasta": string | null,"id": string,"matricula": number | null,"matricula_anual": boolean,"max_ingresos_semana": number | null,"nombre": string,"orden": number,"reinicio_tras_dias": number | null,"renovacion": string | null,"tipo": string,"todas_las_sedes": boolean,"tolerancia_dias": number | null,"usa_regla_gimnasio": boolean,"validez_dias": number | null,"visible_en_landing": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"actualizado_por"?: string | null,"cantidad_clases"?: number | null,"consume_en"?: string | null,"creado_en"?: string,"descripcion"?: string | null,"dia_fijo"?: number | null,"duracion_meses"?: number | null,"gimnasio_id": string,"hora_desde"?: string | null,"hora_hasta"?: string | null,"id"?: string,"matricula"?: number | null,"matricula_anual"?: boolean,"max_ingresos_semana"?: number | null,"nombre": string,"orden"?: number,"reinicio_tras_dias"?: number | null,"renovacion"?: string | null,"tipo": string,"todas_las_sedes"?: boolean,"tolerancia_dias"?: number | null,"usa_regla_gimnasio"?: boolean,"validez_dias"?: number | null,"visible_en_landing"?: boolean
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"actualizado_por"?: string | null,"cantidad_clases"?: number | null,"consume_en"?: string | null,"creado_en"?: string,"descripcion"?: string | null,"dia_fijo"?: number | null,"duracion_meses"?: number | null,"gimnasio_id"?: string,"hora_desde"?: string | null,"hora_hasta"?: string | null,"id"?: string,"matricula"?: number | null,"matricula_anual"?: boolean,"max_ingresos_semana"?: number | null,"nombre"?: string,"orden"?: number,"reinicio_tras_dias"?: number | null,"renovacion"?: string | null,"tipo"?: string,"todas_las_sedes"?: boolean,"tolerancia_dias"?: number | null,"usa_regla_gimnasio"?: boolean,"validez_dias"?: number | null,"visible_en_landing"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "planes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"plantillas_mensaje": {
                  Row: {
                    "actualizado_en": string,"clave": string,"gimnasio_id": string,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"clave": string,"gimnasio_id": string,"texto": string
                  }
                  Update: {
                    "actualizado_en"?: string,"clave"?: string,"gimnasio_id"?: string,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plantillas_mensaje_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"plantillas_texto": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"clave": string,"id": string,"tipo": string | null,"valor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"clave": string,"id"?: string,"tipo"?: string | null,"valor": string
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"clave"?: string,"id"?: string,"tipo"?: string | null,"valor"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plataforma_ajustes": {
                  Row: {
                    "clave": string,"valor": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"valor": NonNullable<Json>
                  }
                  Update: {
                    "clave"?: string,"valor"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"plataforma_contacto": {
                  Row: {
                    "actualizado_en": string,"id": boolean,"mensaje_demo": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"id"?: boolean,"mensaje_demo"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"id"?: boolean,"mensaje_demo"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"plataforma_pagos": {
                  Row: {
                    "anulado_en": string | null,"creado_en": string,"cubre_hasta": string,"gimnasio_id": string,"id": string,"monto": number,"nota": string | null,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulado_en"?: string | null,"creado_en"?: string,"cubre_hasta": string,"gimnasio_id": string,"id"?: string,"monto": number,"nota"?: string | null,"registrado_por": string
                  }
                  Update: {
                    "anulado_en"?: string | null,"creado_en"?: string,"cubre_hasta"?: string,"gimnasio_id"?: string,"id"?: string,"monto"?: number,"nota"?: string | null,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plataforma_pagos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"plataforma_planes": {
                  Row: {
                    "activo": boolean,"creado_en": string,"descripcion": string | null,"id": string,"max_sedes": number | null,"max_socios": number | null,"modulos": (string)[],"nombre": string,"precio_mensual": number,"publico": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"max_sedes"?: number | null,"max_socios"?: number | null,"modulos"?: (string)[],"nombre": string,"precio_mensual": number,"publico"?: boolean
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"max_sedes"?: number | null,"max_socios"?: number | null,"modulos"?: (string)[],"nombre"?: string,"precio_mensual"?: number,"publico"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"precios_plan": {
                  Row: {
                    "creado_en": string,"creado_por": string | null,"gimnasio_id": string,"id": string,"medio_pago": string | null,"monto": number,"pago_hasta_dia": number | null,"plan_id": string,"sede_id": string | null,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por"?: string | null,"gimnasio_id": string,"id"?: string,"medio_pago"?: string | null,"monto": number,"pago_hasta_dia"?: number | null,"plan_id": string,"sede_id"?: string | null,"vigente_desde": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string | null,"gimnasio_id"?: string,"id"?: string,"medio_pago"?: string | null,"monto"?: number,"pago_hasta_dia"?: number | null,"plan_id"?: string,"sede_id"?: string | null,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "precios_plan_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "precios_plan_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "precios_plan_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"preferencias_aviso": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"canal": string,"gimnasio_id": string,"id": string,"tipo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo": boolean,"actualizado_en"?: string,"canal": string,"gimnasio_id": string,"id"?: string,"tipo": string,"usuario_id": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"canal"?: string,"gimnasio_id"?: string,"id"?: string,"tipo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "preferencias_aviso_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"presupuestos_gasto": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string,"categoria": string,"gimnasio_id": string,"id": string,"monto": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por": string,"categoria": string,"gimnasio_id": string,"id"?: string,"monto": number
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string,"categoria"?: string,"gimnasio_id"?: string,"id"?: string,"monto"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "presupuestos_gasto_gimnasio_id_actualizado_por_fkey"
      columns: ["gimnasio_id","actualizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "presupuestos_gasto_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"productos": {
                  Row: {
                    "activo": boolean,"categoria": string | null,"controla_stock": boolean,"costo": number | null,"creado_en": string,"foto_path": string | null,"gimnasio_id": string,"id": string,"locker_meses": number | null,"nombre": string,"orden": number,"permite_stock_negativo": boolean,"precio": number,"pt_entrenador_id": string | null,"pt_sesiones": number | null,"pt_validez_dias": number | null,"recurrente": boolean,"stock_minimo": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"categoria"?: string | null,"controla_stock"?: boolean,"costo"?: number | null,"creado_en"?: string,"foto_path"?: string | null,"gimnasio_id": string,"id"?: string,"locker_meses"?: number | null,"nombre": string,"orden"?: number,"permite_stock_negativo"?: boolean,"precio": number,"pt_entrenador_id"?: string | null,"pt_sesiones"?: number | null,"pt_validez_dias"?: number | null,"recurrente"?: boolean,"stock_minimo"?: number | null
                  }
                  Update: {
                    "activo"?: boolean,"categoria"?: string | null,"controla_stock"?: boolean,"costo"?: number | null,"creado_en"?: string,"foto_path"?: string | null,"gimnasio_id"?: string,"id"?: string,"locker_meses"?: number | null,"nombre"?: string,"orden"?: number,"permite_stock_negativo"?: boolean,"precio"?: number,"pt_entrenador_id"?: string | null,"pt_sesiones"?: number | null,"pt_validez_dias"?: number | null,"recurrente"?: boolean,"stock_minimo"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "productos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "productos_pt_entrenador_fk"
      columns: ["gimnasio_id","pt_entrenador_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"promesas_pago": {
                  Row: {
                    "autorizado_por": string | null,"creado_en": string,"dias_max": number | null,"gimnasio_id": string,"id": string,"ingreso_id": string,"modo": string,"pedido_por": string | null,"promete_el": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autorizado_por"?: string | null,"creado_en"?: string,"dias_max"?: number | null,"gimnasio_id": string,"id"?: string,"ingreso_id": string,"modo": string,"pedido_por"?: string | null,"promete_el"?: string | null,"socio_id": string
                  }
                  Update: {
                    "autorizado_por"?: string | null,"creado_en"?: string,"dias_max"?: number | null,"gimnasio_id"?: string,"id"?: string,"ingreso_id"?: string,"modo"?: string,"pedido_por"?: string | null,"promete_el"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promesas_pago_gimnasio_id_autorizado_por_fkey"
      columns: ["gimnasio_id","autorizado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "promesas_pago_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promesas_pago_gimnasio_id_ingreso_id_fkey"
      columns: ["gimnasio_id","ingreso_id"]
isOneToOne: true
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "promesas_pago_gimnasio_id_pedido_por_fkey"
      columns: ["gimnasio_id","pedido_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "promesas_pago_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"prospectos": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"dni": string | null,"estado": string,"gimnasio_id": string,"id": string,"interes": string | null,"invitado_id": string | null,"nombre": string,"nota": string | null,"origen": string,"referido_por": string | null,"socio_id": string | null,"telefono": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"dni"?: string | null,"estado"?: string,"gimnasio_id": string,"id"?: string,"interes"?: string | null,"invitado_id"?: string | null,"nombre": string,"nota"?: string | null,"origen"?: string,"referido_por"?: string | null,"socio_id"?: string | null,"telefono": string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"dni"?: string | null,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"interes"?: string | null,"invitado_id"?: string | null,"nombre"?: string,"nota"?: string | null,"origen"?: string,"referido_por"?: string | null,"socio_id"?: string | null,"telefono"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prospectos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prospectos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "prospectos_invitado_fk"
      columns: ["gimnasio_id","invitado_id"]
isOneToOne: false
      referencedRelation: "invitados"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "prospectos_referido_por_fk"
      columns: ["gimnasio_id","referido_por"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"proveedores_pago": {
                  Row: {
                    "activo": boolean,"conectado_en": string,"conectado_por": string,"gimnasio_id": string,"id": string,"modo": string,"proveedor": string,"token_secreto_id": string,"webhook_secreto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"conectado_en"?: string,"conectado_por": string,"gimnasio_id": string,"id"?: string,"modo": string,"proveedor"?: string,"token_secreto_id": string,"webhook_secreto_id": string
                  }
                  Update: {
                    "activo"?: boolean,"conectado_en"?: string,"conectado_por"?: string,"gimnasio_id"?: string,"id"?: string,"modo"?: string,"proveedor"?: string,"token_secreto_id"?: string,"webhook_secreto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proveedores_pago_gimnasio_id_conectado_por_fkey"
      columns: ["gimnasio_id","conectado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "proveedores_pago_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"pruebas_gratis": {
                  Row: {
                    "anulada_en": string | null,"anulada_motivo": string | null,"anulada_por": string | null,"clase_id": string | null,"creado_en": string,"dada_por": string | null,"desde": string,"dni": string,"gimnasio_id": string,"hasta": string,"id": string,"modo": string,"nombre": string,"origen": string,"prospecto_id": string | null,"sede_id": string,"socio_id": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"clase_id"?: string | null,"creado_en"?: string,"dada_por"?: string | null,"desde": string,"dni": string,"gimnasio_id": string,"hasta": string,"id"?: string,"modo": string,"nombre": string,"origen": string,"prospecto_id"?: string | null,"sede_id": string,"socio_id"?: string | null,"telefono"?: string | null
                  }
                  Update: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_por"?: string | null,"clase_id"?: string | null,"creado_en"?: string,"dada_por"?: string | null,"desde"?: string,"dni"?: string,"gimnasio_id"?: string,"hasta"?: string,"id"?: string,"modo"?: string,"nombre"?: string,"origen"?: string,"prospecto_id"?: string | null,"sede_id"?: string,"socio_id"?: string | null,"telefono"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pruebas_gratis_gimnasio_id_anulada_por_fkey"
      columns: ["gimnasio_id","anulada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_dada_por_fkey"
      columns: ["gimnasio_id","dada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_prospecto_id_fkey"
      columns: ["gimnasio_id","prospecto_id"]
isOneToOne: false
      referencedRelation: "prospectos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pruebas_gratis_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"pt_franjas": {
                  Row: {
                    "cancelada_en": string | null,"cancelada_motivo": string | null,"cancelada_por": string | null,"creada_en": string,"creada_por": string,"entrenador_id": string,"fin": string,"gimnasio_id": string,"id": string,"inicio": string,"sede_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cancelada_por"?: string | null,"creada_en"?: string,"creada_por": string,"entrenador_id": string,"fin": string,"gimnasio_id": string,"id"?: string,"inicio": string,"sede_id": string
                  }
                  Update: {
                    "cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cancelada_por"?: string | null,"creada_en"?: string,"creada_por"?: string,"entrenador_id"?: string,"fin"?: string,"gimnasio_id"?: string,"id"?: string,"inicio"?: string,"sede_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pt_franjas_gimnasio_id_cancelada_por_fkey"
      columns: ["gimnasio_id","cancelada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pt_franjas_gimnasio_id_creada_por_fkey"
      columns: ["gimnasio_id","creada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pt_franjas_gimnasio_id_entrenador_id_fkey"
      columns: ["gimnasio_id","entrenador_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "pt_franjas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pt_franjas_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"recibos": {
                  Row: {
                    "emitido_en": string,"gimnasio_id": string,"id": string,"numero": number,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "emitido_en"?: string,"gimnasio_id": string,"id"?: string,"numero": number,"venta_id": string
                  }
                  Update: {
                    "emitido_en"?: string,"gimnasio_id"?: string,"id"?: string,"numero"?: number,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recibos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recibos_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: true
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"reemplazos_profe": {
                  Row: {
                    "clase_id": string,"creado_en": string,"gimnasio_id": string,"hecho_por": string,"id": string,"motivo": string,"profe_anterior_id": string | null,"profe_nuevo_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clase_id": string,"creado_en"?: string,"gimnasio_id": string,"hecho_por": string,"id"?: string,"motivo": string,"profe_anterior_id"?: string | null,"profe_nuevo_id": string
                  }
                  Update: {
                    "clase_id"?: string,"creado_en"?: string,"gimnasio_id"?: string,"hecho_por"?: string,"id"?: string,"motivo"?: string,"profe_anterior_id"?: string | null,"profe_nuevo_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reemplazos_profe_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reemplazos_profe_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reemplazos_profe_gimnasio_id_hecho_por_fkey"
      columns: ["gimnasio_id","hecho_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reemplazos_profe_gimnasio_id_profe_anterior_id_fkey"
      columns: ["gimnasio_id","profe_anterior_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reemplazos_profe_gimnasio_id_profe_nuevo_id_fkey"
      columns: ["gimnasio_id","profe_nuevo_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"registro_brik": {
                  Row: {
                    "accion": string,"creado_en": string,"detalle": NonNullable<Json>,"gimnasio_id": string | null,"id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": string,"creado_en"?: string,"detalle"?: NonNullable<Json>,"gimnasio_id"?: string | null,"id"?: string,"usuario_id": string
                  }
                  Update: {
                    "accion"?: string,"creado_en"?: string,"detalle"?: NonNullable<Json>,"gimnasio_id"?: string | null,"id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registro_brik_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"registros_ejercicio": {
                  Row: {
                    "anotado_por": string,"anulado_en": string | null,"ejercicio_id": string,"gimnasio_id": string,"id": string,"momento": string,"peso": number | null,"repeticiones": number | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anotado_por": string,"anulado_en"?: string | null,"ejercicio_id": string,"gimnasio_id": string,"id"?: string,"momento"?: string,"peso"?: number | null,"repeticiones"?: number | null,"socio_id": string
                  }
                  Update: {
                    "anotado_por"?: string,"anulado_en"?: string | null,"ejercicio_id"?: string,"gimnasio_id"?: string,"id"?: string,"momento"?: string,"peso"?: number | null,"repeticiones"?: number | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "registros_ejercicio_gimnasio_id_ejercicio_id_fkey"
      columns: ["gimnasio_id","ejercicio_id"]
isOneToOne: false
      referencedRelation: "ejercicios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "registros_ejercicio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registros_ejercicio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"reglamentos": {
                  Row: {
                    "creado_en": string,"creado_por": string | null,"gimnasio_id": string,"id": string,"texto": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por"?: string | null,"gimnasio_id": string,"id"?: string,"texto": string,"version": number
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string | null,"gimnasio_id"?: string,"id"?: string,"texto"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reglamentos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"reglas_pago_profe": {
                  Row: {
                    "creado_en": string,"creado_por": string,"gimnasio_id": string,"id": string,"modo": string,"monto": number,"profe_id": string,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por": string,"gimnasio_id": string,"id"?: string,"modo": string,"monto": number,"profe_id": string,"vigente_desde": string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string,"gimnasio_id"?: string,"id"?: string,"modo"?: string,"monto"?: number,"profe_id"?: string,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reglas_pago_profe_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reglas_pago_profe_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reglas_pago_profe_gimnasio_id_profe_id_fkey"
      columns: ["gimnasio_id","profe_id"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"reservas": {
                  Row: {
                    "cancelada_en": string | null,"cancelada_por": string | null,"clase_id": string,"creado_en": string,"estado": string,"gimnasio_id": string,"id": string,"lugar": number | null,"oferta_perdida": boolean,"ofrecida_en": string | null,"ofrecida_hasta": string | null,"pack_id": string | null,"promovida_en": string | null,"socio_id": string,"turno_fijo_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada_en"?: string | null,"cancelada_por"?: string | null,"clase_id": string,"creado_en"?: string,"estado": string,"gimnasio_id": string,"id"?: string,"lugar"?: number | null,"oferta_perdida"?: boolean,"ofrecida_en"?: string | null,"ofrecida_hasta"?: string | null,"pack_id"?: string | null,"promovida_en"?: string | null,"socio_id": string,"turno_fijo_id"?: string | null
                  }
                  Update: {
                    "cancelada_en"?: string | null,"cancelada_por"?: string | null,"clase_id"?: string,"creado_en"?: string,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"lugar"?: number | null,"oferta_perdida"?: boolean,"ofrecida_en"?: string | null,"ofrecida_hasta"?: string | null,"pack_id"?: string | null,"promovida_en"?: string | null,"socio_id"?: string,"turno_fijo_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservas_gimnasio_id_clase_id_fkey"
      columns: ["gimnasio_id","clase_id"]
isOneToOne: false
      referencedRelation: "clases"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reservas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservas_gimnasio_id_pack_id_fkey"
      columns: ["gimnasio_id","pack_id"]
isOneToOne: false
      referencedRelation: "packs"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reservas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "reservas_turno_fijo_fk"
      columns: ["gimnasio_id","turno_fijo_id"]
isOneToOne: false
      referencedRelation: "turnos_fijos"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"respuestas_rapidas_mensajes": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"orden": number,"texto": string,"titulo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"orden"?: number,"texto": string,"titulo": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"orden"?: number,"texto"?: string,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "respuestas_rapidas_mensajes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"rutina_dias_hechos": {
                  Row: {
                    "creado_en": string,"dia": number,"fecha": string,"gimnasio_id": string,"id": string,"rutina_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dia": number,"fecha": string,"gimnasio_id": string,"id"?: string,"rutina_id": string,"socio_id": string
                  }
                  Update: {
                    "creado_en"?: string,"dia"?: number,"fecha"?: string,"gimnasio_id"?: string,"id"?: string,"rutina_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rutina_dias_hechos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rutina_dias_hechos_gimnasio_id_rutina_id_fkey"
      columns: ["gimnasio_id","rutina_id"]
isOneToOne: false
      referencedRelation: "rutinas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutina_dias_hechos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"rutina_ejercicios": {
                  Row: {
                    "dia": number,"ejercicio_id": string,"gimnasio_id": string,"id": string,"nota": string | null,"orden": number,"repeticiones": string,"rutina_id": string,"series": number
                  }
                  ComputedFields: never
                  Insert: {
                    "dia": number,"ejercicio_id": string,"gimnasio_id": string,"id"?: string,"nota"?: string | null,"orden": number,"repeticiones": string,"rutina_id": string,"series": number
                  }
                  Update: {
                    "dia"?: number,"ejercicio_id"?: string,"gimnasio_id"?: string,"id"?: string,"nota"?: string | null,"orden"?: number,"repeticiones"?: string,"rutina_id"?: string,"series"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rutina_ejercicios_gimnasio_id_ejercicio_id_fkey"
      columns: ["gimnasio_id","ejercicio_id"]
isOneToOne: false
      referencedRelation: "ejercicios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutina_ejercicios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rutina_ejercicios_gimnasio_id_rutina_id_fkey"
      columns: ["gimnasio_id","rutina_id"]
isOneToOne: false
      referencedRelation: "rutinas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"rutina_series_hechas": {
                  Row: {
                    "creado_en": string,"dia": number,"ejercicio_id": string,"fecha": string,"gimnasio_id": string,"id": string,"rutina_id": string,"serie": number,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dia": number,"ejercicio_id": string,"fecha": string,"gimnasio_id": string,"id"?: string,"rutina_id": string,"serie": number,"socio_id": string
                  }
                  Update: {
                    "creado_en"?: string,"dia"?: number,"ejercicio_id"?: string,"fecha"?: string,"gimnasio_id"?: string,"id"?: string,"rutina_id"?: string,"serie"?: number,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rutina_series_hechas_gimnasio_id_ejercicio_id_fkey"
      columns: ["gimnasio_id","ejercicio_id"]
isOneToOne: false
      referencedRelation: "ejercicios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutina_series_hechas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rutina_series_hechas_gimnasio_id_rutina_id_fkey"
      columns: ["gimnasio_id","rutina_id"]
isOneToOne: false
      referencedRelation: "rutinas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutina_series_hechas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"rutinas": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"creado_en": string,"creado_por": string | null,"descripcion": string | null,"gimnasio_id": string,"id": string,"nombre": string,"plantilla": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"gimnasio_id": string,"id"?: string,"nombre": string,"plantilla"?: boolean
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"creado_en"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"gimnasio_id"?: string,"id"?: string,"nombre"?: string,"plantilla"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "rutinas_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutinas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"rutinas_socio": {
                  Row: {
                    "asignada_en": string,"asignada_por": string | null,"cambiar_en": string | null,"gimnasio_id": string,"id": string,"quitada_en": string | null,"rutina_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asignada_en"?: string,"asignada_por"?: string | null,"cambiar_en"?: string | null,"gimnasio_id": string,"id"?: string,"quitada_en"?: string | null,"rutina_id": string,"socio_id": string
                  }
                  Update: {
                    "asignada_en"?: string,"asignada_por"?: string | null,"cambiar_en"?: string | null,"gimnasio_id"?: string,"id"?: string,"quitada_en"?: string | null,"rutina_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rutinas_socio_gimnasio_id_asignada_por_fkey"
      columns: ["gimnasio_id","asignada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutinas_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rutinas_socio_gimnasio_id_rutina_id_fkey"
      columns: ["gimnasio_id","rutina_id"]
isOneToOne: false
      referencedRelation: "rutinas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "rutinas_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"salidas": {
                  Row: {
                    "creado_en": string,"dispositivo_id": string | null,"gimnasio_id": string,"id": string,"ingreso_id": string,"momento": string,"registrado_por": string | null,"sede_id": string,"socio_id": string,"via_acceso": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dispositivo_id"?: string | null,"gimnasio_id": string,"id"?: string,"ingreso_id": string,"momento": string,"registrado_por"?: string | null,"sede_id": string,"socio_id": string,"via_acceso": string
                  }
                  Update: {
                    "creado_en"?: string,"dispositivo_id"?: string | null,"gimnasio_id"?: string,"id"?: string,"ingreso_id"?: string,"momento"?: string,"registrado_por"?: string | null,"sede_id"?: string,"socio_id"?: string,"via_acceso"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "salidas_gimnasio_id_dispositivo_id_fkey"
      columns: ["gimnasio_id","dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "salidas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salidas_gimnasio_id_ingreso_id_fkey"
      columns: ["gimnasio_id","ingreso_id"]
isOneToOne: true
      referencedRelation: "ingresos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "salidas_gimnasio_id_registrado_por_fkey"
      columns: ["gimnasio_id","registrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "salidas_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "salidas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"sedes": {
                  Row: {
                    "activa": boolean,"creado_en": string,"direccion": string | null,"es_principal": boolean,"gimnasio_id": string,"id": string,"mapa_url": string | null,"nombre": string,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"creado_en"?: string,"direccion"?: string | null,"es_principal"?: boolean,"gimnasio_id": string,"id"?: string,"mapa_url"?: string | null,"nombre": string,"telefono"?: string | null
                  }
                  Update: {
                    "activa"?: boolean,"creado_en"?: string,"direccion"?: string | null,"es_principal"?: boolean,"gimnasio_id"?: string,"id"?: string,"mapa_url"?: string | null,"nombre"?: string,"telefono"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sedes_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"servicios_socio": {
                  Row: {
                    "creado_por": string,"desde": string,"gimnasio_id": string,"hasta": string | null,"id": string,"producto_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_por": string,"desde"?: string,"gimnasio_id": string,"hasta"?: string | null,"id"?: string,"producto_id": string,"socio_id": string
                  }
                  Update: {
                    "creado_por"?: string,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string | null,"id"?: string,"producto_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "servicios_socio_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "servicios_socio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servicios_socio_gimnasio_id_producto_id_fkey"
      columns: ["gimnasio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "servicios_socio_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"sesiones_pt": {
                  Row: {
                    "cancelada_en": string | null,"cancelada_motivo": string | null,"cancelada_origen": string | null,"cancelada_por": string | null,"creada_en": string,"estado": string,"franja_id": string,"gimnasio_id": string,"id": string,"marcada_en": string | null,"marcada_por": string | null,"reservada_por": string | null,"socio_id": string,"venta_item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cancelada_origen"?: string | null,"cancelada_por"?: string | null,"creada_en"?: string,"estado"?: string,"franja_id": string,"gimnasio_id": string,"id"?: string,"marcada_en"?: string | null,"marcada_por"?: string | null,"reservada_por"?: string | null,"socio_id": string,"venta_item_id": string
                  }
                  Update: {
                    "cancelada_en"?: string | null,"cancelada_motivo"?: string | null,"cancelada_origen"?: string | null,"cancelada_por"?: string | null,"creada_en"?: string,"estado"?: string,"franja_id"?: string,"gimnasio_id"?: string,"id"?: string,"marcada_en"?: string | null,"marcada_por"?: string | null,"reservada_por"?: string | null,"socio_id"?: string,"venta_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sesiones_pt_gimnasio_id_cancelada_por_fkey"
      columns: ["gimnasio_id","cancelada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_franja_id_fkey"
      columns: ["gimnasio_id","franja_id"]
isOneToOne: false
      referencedRelation: "pt_franjas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_marcada_por_fkey"
      columns: ["gimnasio_id","marcada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_reservada_por_fkey"
      columns: ["gimnasio_id","reservada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "sesiones_pt_gimnasio_id_venta_item_id_fkey"
      columns: ["gimnasio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"slugs_anteriores": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"slug": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slugs_anteriores_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"socio_convenios": {
                  Row: {
                    "convenio_id": string,"creado_por": string,"desde": string,"gimnasio_id": string,"hasta": string | null,"id": string,"quitado_en": string | null,"quitado_por": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "convenio_id": string,"creado_por": string,"desde"?: string,"gimnasio_id": string,"hasta"?: string | null,"id"?: string,"quitado_en"?: string | null,"quitado_por"?: string | null,"socio_id": string
                  }
                  Update: {
                    "convenio_id"?: string,"creado_por"?: string,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string | null,"id"?: string,"quitado_en"?: string | null,"quitado_por"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "socio_convenios_gimnasio_id_convenio_id_fkey"
      columns: ["gimnasio_id","convenio_id"]
isOneToOne: false
      referencedRelation: "convenios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socio_convenios_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socio_convenios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "socio_convenios_gimnasio_id_quitado_por_fkey"
      columns: ["gimnasio_id","quitado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socio_convenios_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"socio_etiquetas": {
                  Row: {
                    "etiqueta_id": string,"gimnasio_id": string,"puesta_en": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "etiqueta_id": string,"gimnasio_id": string,"puesta_en"?: string,"socio_id": string
                  }
                  Update: {
                    "etiqueta_id"?: string,"gimnasio_id"?: string,"puesta_en"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "socio_etiquetas_gimnasio_id_etiqueta_id_fkey"
      columns: ["gimnasio_id","etiqueta_id"]
isOneToOne: false
      referencedRelation: "etiquetas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socio_etiquetas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "socio_etiquetas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"socios": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"anonimizado_en": string | null,"apellido": string,"aviso_clase_1h": boolean,"bienvenida_vista_en": string | null,"codigo_referido": string | null,"consentimiento_datos_en": string | null,"contacto_emergencia_nombre": string | null,"contacto_emergencia_telefono": string | null,"creado_en": string,"creado_por": string | null,"cubierto_hasta": string | null,"dado_de_baja_en": string | null,"dni": string | null,"email": string | null,"es_ejemplo": boolean,"fecha_nacimiento": string | null,"foto_path": string | null,"foto_sin_confirmar_desde": string | null,"gimnasio_id": string,"grupo_familiar_id": string | null,"id": string,"importacion_id": string | null,"llavero": string | null,"motivo_baja": string | null,"no_escribirle_en": string | null,"no_escribirle_motivo": string | null,"no_escribirle_por": string | null,"nombre": string,"notas": string | null,"numero": number,"origen": string,"responsable_nombre": string | null,"responsable_telefono": string | null,"telefono": string | null,"tutor_socio_id": string | null,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"anonimizado_en"?: string | null,"apellido"?: string,"aviso_clase_1h"?: boolean,"bienvenida_vista_en"?: string | null,"codigo_referido"?: string | null,"consentimiento_datos_en"?: string | null,"contacto_emergencia_nombre"?: string | null,"contacto_emergencia_telefono"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"cubierto_hasta"?: string | null,"dado_de_baja_en"?: string | null,"dni"?: string | null,"email"?: string | null,"es_ejemplo"?: boolean,"fecha_nacimiento"?: string | null,"foto_path"?: string | null,"foto_sin_confirmar_desde"?: string | null,"gimnasio_id": string,"grupo_familiar_id"?: string | null,"id"?: string,"importacion_id"?: string | null,"llavero"?: string | null,"motivo_baja"?: string | null,"no_escribirle_en"?: string | null,"no_escribirle_motivo"?: string | null,"no_escribirle_por"?: string | null,"nombre": string,"notas"?: string | null,"numero": number,"origen"?: string,"responsable_nombre"?: string | null,"responsable_telefono"?: string | null,"telefono"?: string | null,"tutor_socio_id"?: string | null,"usuario_id"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"anonimizado_en"?: string | null,"apellido"?: string,"aviso_clase_1h"?: boolean,"bienvenida_vista_en"?: string | null,"codigo_referido"?: string | null,"consentimiento_datos_en"?: string | null,"contacto_emergencia_nombre"?: string | null,"contacto_emergencia_telefono"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"cubierto_hasta"?: string | null,"dado_de_baja_en"?: string | null,"dni"?: string | null,"email"?: string | null,"es_ejemplo"?: boolean,"fecha_nacimiento"?: string | null,"foto_path"?: string | null,"foto_sin_confirmar_desde"?: string | null,"gimnasio_id"?: string,"grupo_familiar_id"?: string | null,"id"?: string,"importacion_id"?: string | null,"llavero"?: string | null,"motivo_baja"?: string | null,"no_escribirle_en"?: string | null,"no_escribirle_motivo"?: string | null,"no_escribirle_por"?: string | null,"nombre"?: string,"notas"?: string | null,"numero"?: number,"origen"?: string,"responsable_nombre"?: string | null,"responsable_telefono"?: string | null,"telefono"?: string | null,"tutor_socio_id"?: string | null,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "socios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "socios_gimnasio_id_tutor_socio_id_fkey"
      columns: ["gimnasio_id","tutor_socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socios_grupo_familiar_fk"
      columns: ["gimnasio_id","grupo_familiar_id"]
isOneToOne: false
      referencedRelation: "grupos_familiares"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socios_importacion_fk"
      columns: ["gimnasio_id","importacion_id"]
isOneToOne: false
      referencedRelation: "importaciones"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "socios_no_escribirle_por_fk"
      columns: ["gimnasio_id","no_escribirle_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"soportes_gimnasio": {
                  Row: {
                    "entro_en": string,"gimnasio_id": string,"id": string,"motivo": string,"plata_autorizada": boolean,"rol": string,"salio_en": string | null,"usuario_id": string,"vence_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entro_en"?: string,"gimnasio_id": string,"id"?: string,"motivo": string,"plata_autorizada"?: boolean,"rol"?: string,"salio_en"?: string | null,"usuario_id": string,"vence_en"?: string
                  }
                  Update: {
                    "entro_en"?: string,"gimnasio_id"?: string,"id"?: string,"motivo"?: string,"plata_autorizada"?: boolean,"rol"?: string,"salio_en"?: string | null,"usuario_id"?: string,"vence_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "soportes_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"suscripciones": {
                  Row: {
                    "baja_en": string | null,"creado_en": string,"creado_por": string | null,"gimnasio_id": string,"id": string,"importacion_id": string | null,"inicio": string,"motivo_baja": string | null,"plan_id": string,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "baja_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"gimnasio_id": string,"id"?: string,"importacion_id"?: string | null,"inicio": string,"motivo_baja"?: string | null,"plan_id": string,"socio_id": string
                  }
                  Update: {
                    "baja_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"gimnasio_id"?: string,"id"?: string,"importacion_id"?: string | null,"inicio"?: string,"motivo_baja"?: string | null,"plan_id"?: string,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripciones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suscripciones_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "suscripciones_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "suscripciones_importacion_fk"
      columns: ["gimnasio_id","importacion_id"]
isOneToOne: false
      referencedRelation: "importaciones"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"suscripciones_push": {
                  Row: {
                    "auth": string,"creado_en": string,"endpoint": string,"gimnasio_id": string,"id": string,"p256dh": string,"tipos": (string)[],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"creado_en"?: string,"endpoint": string,"gimnasio_id": string,"id"?: string,"p256dh": string,"tipos"?: (string)[],"usuario_id": string
                  }
                  Update: {
                    "auth"?: string,"creado_en"?: string,"endpoint"?: string,"gimnasio_id"?: string,"id"?: string,"p256dh"?: string,"tipos"?: (string)[],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripciones_push_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"suspensiones": {
                  Row: {
                    "creado_en": string,"creado_por": string | null,"desde": string,"gimnasio_id": string,"hasta": string | null,"id": string,"levantada_en": string | null,"levantada_motivo": string | null,"levantada_por": string | null,"motivo": string,"revisar_en": string | null,"socio_id": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"creado_por"?: string | null,"desde": string,"gimnasio_id": string,"hasta"?: string | null,"id"?: string,"levantada_en"?: string | null,"levantada_motivo"?: string | null,"levantada_por"?: string | null,"motivo": string,"revisar_en"?: string | null,"socio_id": string,"tipo"?: string
                  }
                  Update: {
                    "creado_en"?: string,"creado_por"?: string | null,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string | null,"id"?: string,"levantada_en"?: string | null,"levantada_motivo"?: string | null,"levantada_por"?: string | null,"motivo"?: string,"revisar_en"?: string | null,"socio_id"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suspensiones_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suspensiones_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"tareas": {
                  Row: {
                    "creada_por": string,"creado_en": string,"dia": string,"gimnasio_id": string,"hecha_en": string | null,"hecha_por": string | null,"id": string,"origen_id": string | null,"para": string,"que": string,"repite": string | null,"socio_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creada_por": string,"creado_en"?: string,"dia": string,"gimnasio_id": string,"hecha_en"?: string | null,"hecha_por"?: string | null,"id"?: string,"origen_id"?: string | null,"para": string,"que": string,"repite"?: string | null,"socio_id"?: string | null
                  }
                  Update: {
                    "creada_por"?: string,"creado_en"?: string,"dia"?: string,"gimnasio_id"?: string,"hecha_en"?: string | null,"hecha_por"?: string | null,"id"?: string,"origen_id"?: string | null,"para"?: string,"que"?: string,"repite"?: string | null,"socio_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_gimnasio_id_creada_por_fkey"
      columns: ["gimnasio_id","creada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "tareas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_gimnasio_id_hecha_por_fkey"
      columns: ["gimnasio_id","hecha_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "tareas_gimnasio_id_para_fkey"
      columns: ["gimnasio_id","para"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "tareas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "tareas_origen_fk"
      columns: ["gimnasio_id","origen_id"]
isOneToOne: false
      referencedRelation: "tareas"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"tareas_auto": {
                  Row: {
                    "activa": boolean,"actualizado_en": string,"clave": string,"dias": number | null,"gimnasio_id": string,"para_equipo": string | null,"para_rol": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"actualizado_en"?: string,"clave": string,"dias"?: number | null,"gimnasio_id": string,"para_equipo"?: string | null,"para_rol"?: string | null
                  }
                  Update: {
                    "activa"?: boolean,"actualizado_en"?: string,"clave"?: string,"dias"?: number | null,"gimnasio_id"?: string,"para_equipo"?: string | null,"para_rol"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_auto_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_auto_gimnasio_id_para_equipo_fkey"
      columns: ["gimnasio_id","para_equipo"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"tareas_checklist": {
                  Row: {
                    "activo": boolean,"creado_en": string,"gimnasio_id": string,"id": string,"momento": string,"orden": number,"texto": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"gimnasio_id": string,"id"?: string,"momento": string,"orden"?: number,"texto": string
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"momento"?: string,"orden"?: number,"texto"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_checklist_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"tareas_checklist_hechas": {
                  Row: {
                    "dia": string,"gimnasio_id": string,"hecha_en": string,"hecha_por": string,"item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dia": string,"gimnasio_id": string,"hecha_en"?: string,"hecha_por": string,"item_id": string
                  }
                  Update: {
                    "dia"?: string,"gimnasio_id"?: string,"hecha_en"?: string,"hecha_por"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tareas_checklist_hechas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tareas_checklist_hechas_gimnasio_id_hecha_por_fkey"
      columns: ["gimnasio_id","hecha_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "tareas_checklist_hechas_gimnasio_id_item_id_fkey"
      columns: ["gimnasio_id","item_id"]
isOneToOne: false
      referencedRelation: "tareas_checklist"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"terminos_gimnasio": {
                  Row: {
                    "actualizado_en": string,"actualizado_por": string | null,"gimnasio_id": string,"publicado": boolean,"texto": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"gimnasio_id": string,"publicado"?: boolean,"texto"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"actualizado_por"?: string | null,"gimnasio_id"?: string,"publicado"?: boolean,"texto"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "terminos_gimnasio_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: true
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    }
                  ]
                },"turnos_caja": {
                  Row: {
                    "abierto_en": string,"abierto_por": string,"billetes": Json | null,"caja_id": string,"cerrado_en": string | null,"cerrado_por": string | null,"contado_en": string | null,"gimnasio_id": string,"id": string,"monto_contado": number | null,"monto_esperado": number | null,"monto_inicial": number,"nota": string | null,"revisado_en": string | null,"revisado_nota": string | null,"revisado_por": string | null,"sin_contar": boolean,"sin_contar_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abierto_en"?: string,"abierto_por": string,"billetes"?: Json | null,"caja_id": string,"cerrado_en"?: string | null,"cerrado_por"?: string | null,"contado_en"?: string | null,"gimnasio_id": string,"id"?: string,"monto_contado"?: number | null,"monto_esperado"?: number | null,"monto_inicial": number,"nota"?: string | null,"revisado_en"?: string | null,"revisado_nota"?: string | null,"revisado_por"?: string | null,"sin_contar"?: boolean,"sin_contar_en"?: string | null
                  }
                  Update: {
                    "abierto_en"?: string,"abierto_por"?: string,"billetes"?: Json | null,"caja_id"?: string,"cerrado_en"?: string | null,"cerrado_por"?: string | null,"contado_en"?: string | null,"gimnasio_id"?: string,"id"?: string,"monto_contado"?: number | null,"monto_esperado"?: number | null,"monto_inicial"?: number,"nota"?: string | null,"revisado_en"?: string | null,"revisado_nota"?: string | null,"revisado_por"?: string | null,"sin_contar"?: boolean,"sin_contar_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "turnos_caja_gimnasio_id_abierto_por_fkey"
      columns: ["gimnasio_id","abierto_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_caja_gimnasio_id_caja_id_fkey"
      columns: ["gimnasio_id","caja_id"]
isOneToOne: false
      referencedRelation: "cajas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_caja_gimnasio_id_cerrado_por_fkey"
      columns: ["gimnasio_id","cerrado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_caja_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turnos_caja_revisado_por_fk"
      columns: ["gimnasio_id","revisado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"turnos_fijos": {
                  Row: {
                    "creado_por": string | null,"desde": string,"gimnasio_id": string,"hasta": string | null,"horario_id": string,"id": string,"quitado_por": string | null,"socio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_por"?: string | null,"desde"?: string,"gimnasio_id": string,"hasta"?: string | null,"horario_id": string,"id"?: string,"quitado_por"?: string | null,"socio_id": string
                  }
                  Update: {
                    "creado_por"?: string | null,"desde"?: string,"gimnasio_id"?: string,"hasta"?: string | null,"horario_id"?: string,"id"?: string,"quitado_por"?: string | null,"socio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "turnos_fijos_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_fijos_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "turnos_fijos_gimnasio_id_horario_id_fkey"
      columns: ["gimnasio_id","horario_id"]
isOneToOne: false
      referencedRelation: "horarios_clase"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_fijos_gimnasio_id_quitado_por_fkey"
      columns: ["gimnasio_id","quitado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "turnos_fijos_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"uniones_socios": {
                  Row: {
                    "gimnasio_id": string,"id": string,"queda_id": string,"se_fue": NonNullable<Json>,"unido_en": string,"unido_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "gimnasio_id": string,"id"?: string,"queda_id": string,"se_fue": NonNullable<Json>,"unido_en"?: string,"unido_por"?: string | null
                  }
                  Update: {
                    "gimnasio_id"?: string,"id"?: string,"queda_id"?: string,"se_fue"?: NonNullable<Json>,"unido_en"?: string,"unido_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "uniones_socios_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "uniones_socios_gimnasio_id_queda_id_fkey"
      columns: ["gimnasio_id","queda_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"venta_items": {
                  Row: {
                    "cantidad": number,"cubre_cambiada_por": string | null,"cubre_desde": string | null,"cubre_hasta": string | null,"cubre_propuesta_desde": string | null,"cubre_propuesta_hasta": string | null,"descripcion": string,"descuento": number,"descuento_motivo": string | null,"gimnasio_id": string,"id": string,"plan_id": string | null,"precio_unitario": number,"producto_id": string | null,"suscripcion_id": string | null,"tipo": string,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad"?: number,"cubre_cambiada_por"?: string | null,"cubre_desde"?: string | null,"cubre_hasta"?: string | null,"cubre_propuesta_desde"?: string | null,"cubre_propuesta_hasta"?: string | null,"descripcion": string,"descuento"?: number,"descuento_motivo"?: string | null,"gimnasio_id": string,"id"?: string,"plan_id"?: string | null,"precio_unitario": number,"producto_id"?: string | null,"suscripcion_id"?: string | null,"tipo": string,"venta_id": string
                  }
                  Update: {
                    "cantidad"?: number,"cubre_cambiada_por"?: string | null,"cubre_desde"?: string | null,"cubre_hasta"?: string | null,"cubre_propuesta_desde"?: string | null,"cubre_propuesta_hasta"?: string | null,"descripcion"?: string,"descuento"?: number,"descuento_motivo"?: string | null,"gimnasio_id"?: string,"id"?: string,"plan_id"?: string | null,"precio_unitario"?: number,"producto_id"?: string | null,"suscripcion_id"?: string | null,"tipo"?: string,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venta_items_cubre_cambiada_fk"
      columns: ["gimnasio_id","cubre_cambiada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "venta_items_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venta_items_gimnasio_id_plan_id_fkey"
      columns: ["gimnasio_id","plan_id"]
isOneToOne: false
      referencedRelation: "planes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "venta_items_gimnasio_id_venta_id_fkey"
      columns: ["gimnasio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "venta_items_producto_fk"
      columns: ["gimnasio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "venta_items_suscripcion_fk"
      columns: ["gimnasio_id","suscripcion_id"]
isOneToOne: false
      referencedRelation: "suscripciones"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"ventas": {
                  Row: {
                    "anulada_en": string | null,"anulada_motivo": string | null,"anulada_origen": string | null,"anulada_por": string | null,"carga_inicial": boolean,"clave_operacion": string | null,"confirmada_en": string | null,"creado_en": string,"creado_por": string | null,"doble_cobro_de": string | null,"doble_cobro_motivo": string | null,"estado": string,"gimnasio_id": string,"id": string,"importacion_id": string | null,"origen": string,"otro_dia_motivo": string | null,"registrada_en": string | null,"sede_id": string,"socio_id": string | null,"turno_caja_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_origen"?: string | null,"anulada_por"?: string | null,"carga_inicial"?: boolean,"clave_operacion"?: string | null,"confirmada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"doble_cobro_de"?: string | null,"doble_cobro_motivo"?: string | null,"estado"?: string,"gimnasio_id": string,"id"?: string,"importacion_id"?: string | null,"origen": string,"otro_dia_motivo"?: string | null,"registrada_en"?: string | null,"sede_id": string,"socio_id"?: string | null,"turno_caja_id"?: string | null
                  }
                  Update: {
                    "anulada_en"?: string | null,"anulada_motivo"?: string | null,"anulada_origen"?: string | null,"anulada_por"?: string | null,"carga_inicial"?: boolean,"clave_operacion"?: string | null,"confirmada_en"?: string | null,"creado_en"?: string,"creado_por"?: string | null,"doble_cobro_de"?: string | null,"doble_cobro_motivo"?: string | null,"estado"?: string,"gimnasio_id"?: string,"id"?: string,"importacion_id"?: string | null,"origen"?: string,"otro_dia_motivo"?: string | null,"registrada_en"?: string | null,"sede_id"?: string,"socio_id"?: string | null,"turno_caja_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ventas_doble_cobro_de_fk"
      columns: ["gimnasio_id","doble_cobro_de"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_anulada_por_fkey"
      columns: ["gimnasio_id","anulada_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_creado_por_fkey"
      columns: ["gimnasio_id","creado_por"]
isOneToOne: false
      referencedRelation: "equipo"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_sede_id_fkey"
      columns: ["gimnasio_id","sede_id"]
isOneToOne: false
      referencedRelation: "sedes"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_gimnasio_id_turno_caja_id_fkey"
      columns: ["gimnasio_id","turno_caja_id"]
isOneToOne: false
      referencedRelation: "turnos_caja"
      referencedColumns: ["gimnasio_id","id"]
    },{
      foreignKeyName: "ventas_importacion_fk"
      columns: ["gimnasio_id","importacion_id"]
isOneToOne: false
      referencedRelation: "importaciones"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                },"vinculos_google": {
                  Row: {
                    "creado_en": string,"gimnasio_id": string,"id": string,"metodo": string,"revocado_en": string | null,"socio_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"gimnasio_id": string,"id"?: string,"metodo": string,"revocado_en"?: string | null,"socio_id": string,"usuario_id": string
                  }
                  Update: {
                    "creado_en"?: string,"gimnasio_id"?: string,"id"?: string,"metodo"?: string,"revocado_en"?: string | null,"socio_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vinculos_google_gimnasio_id_fkey"
      columns: ["gimnasio_id"]
isOneToOne: false
      referencedRelation: "gimnasios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vinculos_google_gimnasio_id_socio_id_fkey"
      columns: ["gimnasio_id","socio_id"]
isOneToOne: false
      referencedRelation: "socios"
      referencedColumns: ["gimnasio_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "abonar_turno":
{ Args: { "p_horario_id": string,"p_socio_id": string }; Returns: string
                           },
"abrir_caja":
{ Args: { "p_caja_id": string,"p_monto_inicial": number }; Returns: string
                           },
"aceptar_oferta":
{ Args: { "p_reserva_id": string }; Returns: undefined
                           },
"aceptar_reglamento":
{ Args: { "p_socio_id": string,"p_version": number }; Returns: undefined
                           },
"acreditar_cobro_debito":
{ Args: { "p_estado": string,"p_fecha"?: string,"p_gimnasio_id": string,"p_monto": number,"p_mp_pago_id": string,"p_mp_suscripcion_id": string }; Returns: string
                           },
"acreditar_pago_mp":
{ Args: { "p_estado": string,"p_fecha"?: string,"p_monto": number,"p_mp_pago_id": string,"p_pago_id": string,"p_reembolsado"?: number }; Returns: string
                           },
"activar_emergencia_puerta":
{ Args: { "p_gimnasio_id": string,"p_horas"?: number,"p_motivo": string,"p_sede_id": string }; Returns: Json
                           },
"actividad_equipo":
{ Args: { "p_dia"?: string,"p_gimnasio_id": string }; Returns: Json
                           },
"actividades_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "activa": boolean,"actividad_id": string,"color": string,"descripcion": string,"emoji": string,"horarios": number,"nombre": string
            }[]
                           },
"actividades_por_plan":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"actualizar_adhesion_debito":
{ Args: { "p_estado": string,"p_gimnasio_id": string,"p_mp_suscripcion_id": string }; Returns: string
                           },
"actualizar_prospecto":
{ Args: { "p_estado": string,"p_gimnasio_id": string,"p_nota"?: string,"p_prospecto_id": string }; Returns: undefined
                           },
"admin_abonos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_agregar_dominio":
{ Args: { "p_gimnasio_id": string,"p_host": string }; Returns: string
                           },
"admin_agregar_nota":
{ Args: { "p_gimnasio_id": string,"p_texto": string }; Returns: string
                           },
"admin_agregar_persona":
{ Args: { "p_gimnasio_id": string,"p_nombre": string,"p_rol": string }; Returns: string
                           },
"admin_alertas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_almacenamiento":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_alta_gimnasio":
{ Args: { "p_acento"?: string,"p_dominio_base": string,"p_dueno_nombre": string,"p_fondo"?: string,"p_nombre": string,"p_plan_brik"?: string,"p_slug": string,"p_tipo"?: string }; Returns: Json
                           },
"admin_anotar_registro":
{ Args: { "p_accion": string,"p_detalle"?: Json,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_anular_pago_brik":
{ Args: { "p_pago_id": string }; Returns: undefined
                           },
"admin_aplicar_plantilla":
{ Args: { "p_gimnasio_id": string,"p_tipo": string }; Returns: undefined
                           },
"admin_asignar_plan_brik":
{ Args: { "p_gimnasio_id": string,"p_plan_id": string }; Returns: undefined
                           },
"admin_atender_demo":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_ayudas":
{ Args: { "p_pendientes"?: boolean }; Returns: Json
                           },
"admin_borrar_definitivo":
{ Args: { "p_gimnasio_id": string,"p_nombre": string }; Returns: Json
                           },
"admin_borrar_demos_vencidas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"admin_borrar_socio":
{ Args: { "p_gimnasio_id": string,"p_motivo": string,"p_socio_id": string }; Returns: undefined
                           },
"admin_buscar_persona":
{ Args: { "p_motivo": string,"p_q": string }; Returns: Json
                           },
"admin_cambiar_dueno":
{ Args: { "p_equipo_id": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_cambiar_rol_persona":
{ Args: { "p_equipo_id": string,"p_rol": string }; Returns: undefined
                           },
"admin_cambiar_slug":
{ Args: { "p_gimnasio_id": string,"p_slug": string }; Returns: undefined
                           },
"admin_cancelar_mantenimiento":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_cerrar_sesiones_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_motivo": string }; Returns: number
                           },
"admin_clonar_configuracion":
{ Args: { "p_destino": string,"p_origen": string }; Returns: Json
                           },
"admin_confirmar_cuenta":
{ Args: { "p_equipo_id": string }; Returns: undefined
                           },
"admin_confirmar_logo_demo":
{ Args: { "p_gimnasio_id": string,"p_ruta": string }; Returns: undefined
                           },
"admin_crear_demo":
{ Args: { "p_dominio_base": string,"p_interesado": string,"p_tipo": string }; Returns: Json
                           },
"admin_crear_demo_prospecto":
{ Args: { "p_acento"?: string,"p_dominio_base": string,"p_fondo"?: string,"p_nombre": string }; Returns: Json
                           },
"admin_crear_gimnasio":
{ Args: { "p_dominio_base": string,"p_dueno_nombre": string,"p_nombre": string,"p_slug": string }; Returns: Json
                           },
"admin_dar_de_baja":
{ Args: { "p_gimnasio_id": string,"p_motivo": string }; Returns: undefined
                           },
"admin_dar_rol_brik":
{ Args: { "p_email": string,"p_rol": string }; Returns: undefined
                           },
"admin_datos_fiscales":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_demos_prospectos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_demos_vencidas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_dnis_repetidos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_entrar_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_motivo": string,"p_plata"?: boolean,"p_rol"?: string }; Returns: string
                           },
"admin_errores":
{ Args: { "p_gimnasio_id"?: string,"p_horas"?: number }; Returns: Json
                           },
"admin_estado_copias":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_estado_persona":
{ Args: { "p_activo": boolean,"p_equipo_id": string }; Returns: undefined
                           },
"admin_estado_seguridad":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_evento_webhook":
{ Args: { "p_id": string }; Returns: Json
                           },
"admin_exigir_2fa":
{ Args: { "p_exigir": boolean }; Returns: undefined
                           },
"admin_exportar_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_exportar_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string }; Returns: Json
                           },
"admin_ficha_extra":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_funcion_gimnasio":
{ Args: { "p_activa": boolean,"p_clave": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_funciones_prueba":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_gimnasios":
{ Args: Record<PropertyKey, never>; Returns: {
              "creado_en": string,"duenos": (string)[],"duenos_sin_cuenta": number,"es_demo": boolean,"estoy_dentro": boolean,"gimnasio_id": string,"hosts": (string)[],"ingresos_7_dias": number,"nombre": string,"slug": string,"socios": number,"socios_al_dia": number,"suspendido": boolean
            }[]
                           },
"admin_guardar_ciudad":
{ Args: { "p_ciudad": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_guardar_contacto_plataforma":
{ Args: { "p_mensaje": string,"p_whatsapp": string }; Returns: Json
                           },
"admin_guardar_datos_fiscales":
{ Args: { "p_cuit": string,"p_gimnasio_id": string,"p_razon_social": string }; Returns: undefined
                           },
"admin_guardar_descuento":
{ Args: { "p_gimnasio_id": string,"p_hasta": string,"p_motivo": string,"p_porcentaje": number }; Returns: string
                           },
"admin_guardar_detalle_plan_brik":
{ Args: { "p_descripcion": string,"p_id": string,"p_modulos": (string)[] }; Returns: string
                           },
"admin_guardar_estilo":
{ Args: { "p_estilo": string,"p_gimnasio_id": string,"p_modo"?: string }; Returns: string
                           },
"admin_guardar_landing_venta":
{ Args: { "p_activa": boolean }; Returns: boolean
                           },
"admin_guardar_limites_plan":
{ Args: { "p_max_sedes": number,"p_max_socios": number,"p_plan_id": string }; Returns: undefined
                           },
"admin_guardar_link_pago":
{ Args: { "p_link": string }; Returns: undefined
                           },
"admin_guardar_marca":
{ Args: { "p_acento": string,"p_fondo": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_guardar_modulos":
{ Args: { "p_apagadas": (string)[],"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_guardar_plan_brik":
{ Args: { "p_activo"?: boolean,"p_id": string,"p_nombre": string,"p_precio": number }; Returns: string
                           },
"admin_guardar_plantilla_texto":
{ Args: { "p_clave": string,"p_tipo": string,"p_valor": string }; Returns: number
                           },
"admin_guardar_prueba":
{ Args: { "p_dias": number,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_guardar_tipo_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_tipo": string }; Returns: undefined
                           },
"admin_landing_venta":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"admin_lanzamiento":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_limites_gimnasios":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_link_pago":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"admin_lista_gimnasios":
{ Args: { "p_abono"?: string,"p_alta_desde"?: string,"p_alta_hasta"?: string,"p_ciudad"?: string,"p_con_bajas"?: boolean,"p_modulo"?: string,"p_plan"?: string,"p_q"?: string,"p_salud"?: string }; Returns: Json
                           },
"admin_mantenimientos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_marcar_favorito":
{ Args: { "p_favorito": boolean,"p_gimnasio_id": string }; Returns: undefined
                           },
"admin_metricas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_mover_persona":
{ Args: { "p_equipo_id": string,"p_gimnasio_destino": string,"p_rol"?: string }; Returns: string
                           },
"admin_notas":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_novedades":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_papelera":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_pausar_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_motivo": string }; Returns: undefined
                           },
"admin_pedidos_demo":
{ Args: { "p_pendientes"?: boolean }; Returns: Json
                           },
"admin_plan_publico":
{ Args: { "p_plan_id": string,"p_publico": boolean }; Returns: undefined
                           },
"admin_planes_brik":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_planes_con_limites":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_plantillas_texto":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_plataforma_estado":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_prender_funcion":
{ Args: { "p_clave": string,"p_gimnasio_id": string,"p_prendida": boolean }; Returns: undefined
                           },
"admin_preparar_logo_demo":
{ Args: { "p_bytes": number,"p_gimnasio_id": string,"p_tipo_mime": string }; Returns: string
                           },
"admin_probar_acceso":
{ Args: { "p_equipo_id": string }; Returns: Json
                           },
"admin_probar_acceso_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_programar_mantenimiento":
{ Args: { "p_desde": string,"p_hasta": string,"p_texto": string }; Returns: string
                           },
"admin_publicar_novedad":
{ Args: { "p_ciudad"?: string,"p_link"?: string,"p_modulo"?: string,"p_plan"?: string,"p_texto": string,"p_titulo": string }; Returns: string
                           },
"admin_quitar_descuento":
{ Args: { "p_gimnasio_id": string }; Returns: undefined
                           },
"admin_quitar_dominio":
{ Args: { "p_dominio_id": string }; Returns: undefined
                           },
"admin_quitar_rol_brik":
{ Args: { "p_usuario_id": string }; Returns: undefined
                           },
"admin_reanudar_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: undefined
                           },
"admin_registrar_equipo":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_registrar_pago_brik":
{ Args: { "p_cubre_hasta": string,"p_gimnasio_id": string,"p_monto": number,"p_nota"?: string }; Returns: string
                           },
"admin_registro_brik":
{ Args: { "p_antes"?: string,"p_limite"?: number }; Returns: Json
                           },
"admin_resolver_ayuda":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_restaurar_baja":
{ Args: { "p_gimnasio_id": string }; Returns: undefined
                           },
"admin_restaurar_plan":
{ Args: { "p_gimnasio_id": string,"p_plan_id": string }; Returns: undefined
                           },
"admin_restaurar_plantilla_texto":
{ Args: { "p_clave": string,"p_tipo": string }; Returns: number
                           },
"admin_restaurar_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string }; Returns: undefined
                           },
"admin_restaurar_texto_gimnasio":
{ Args: { "p_clave": string,"p_gimnasio_id": string }; Returns: string
                           },
"admin_retirar_novedad":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_salir_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: undefined
                           },
"admin_salud_gimnasios":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_salud_v2":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_sesiones_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_soportes":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"admin_tablero":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_tamano_tablas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_uso_gimnasios":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_uso_semanal":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"admin_ver_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string }; Returns: Json
                           },
"agenda_pt":
{ Args: { "p_dias"?: number,"p_entrenador_id"?: string,"p_gimnasio_id": string }; Returns: Json
                           },
"agenda_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"agregar_horario":
{ Args: { "p_actividad_id": string,"p_cupo"?: number,"p_desde"?: string,"p_dia_semana": number,"p_duracion_min": number,"p_hora_inicio": string,"p_profe_id"?: string,"p_sede_id": string }; Returns: string
                           },
"agregar_nota":
{ Args: { "p_socio_id": string,"p_texto": string }; Returns: string
                           },
"ajustes_planes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"alertas_caja":
{ Args: { "p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"alertas_patron_entradas":
{ Args: { "p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"alertas_prestamo":
{ Args: { "p_desde": string,"p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"alquilar_locker":
{ Args: { "p_locker_id": string,"p_meses"?: number,"p_motivo"?: string,"p_socio_id": string,"p_venta_item_id"?: string }; Returns: string
                           },
"alta_online":
{ Args: { "p_datos": Json,"p_host": string,"p_medio": string,"p_plan_id": string,"p_version": number }; Returns: Json
                           },
"alta_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"alta_socio_pasado":
{ Args: { "p_datos": Json,"p_fecha_alta": string,"p_gimnasio_id": string,"p_pagos"?: Json,"p_plan_id": string,"p_sede_id": string }; Returns: Json
                           },
"altas_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"anonimizar_socio":
{ Args: { "p_confirmo": string,"p_socio_id": string }; Returns: undefined
                           },
"anotar_ejercicio":
{ Args: { "p_ejercicio_id": string,"p_peso": number,"p_repeticiones": number,"p_socio_id": string }; Returns: string
                           },
"anotar_origen_alta":
{ Args: { "p_canal": string,"p_socio_id": string }; Returns: boolean
                           },
"anular_apto":
{ Args: { "p_apto_id": string }; Returns: undefined
                           },
"anular_asistencia":
{ Args: { "p_asistencia_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_cierre":
{ Args: { "p_cierre_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_congelamiento":
{ Args: { "p_congelamiento_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_cortesia":
{ Args: { "p_cobertura_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_devolucion":
{ Args: { "p_devolucion_id": string,"p_motivo": string,"p_reintegro_caja"?: boolean }; Returns: Json
                           },
"anular_fichaje":
{ Args: { "p_fichaje_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_gasto":
{ Args: { "p_gasto_id": string }; Returns: undefined
                           },
"anular_grado_socio":
{ Args: { "p_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_horas_profe":
{ Args: { "p_horas_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_ingreso":
{ Args: { "p_ingreso_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_invitado":
{ Args: { "p_invitado_id": string,"p_motivo": string }; Returns: undefined
                           },
"anular_pago_profe":
{ Args: { "p_motivo": string,"p_pago_id": string,"p_turno_id"?: string }; Returns: undefined
                           },
"anular_precio_programado":
{ Args: { "p_desde": string,"p_plan_id": string }; Returns: number
                           },
"anular_presente":
{ Args: { "p_clase_id": string,"p_motivo": string,"p_socio_id": string }; Returns: undefined
                           },
"anular_prueba_gratis":
{ Args: { "p_motivo": string,"p_prueba_id": string }; Returns: undefined
                           },
"anular_registro":
{ Args: { "p_registro_id": string }; Returns: undefined
                           },
"anular_venta":
{ Args: { "p_motivo": string,"p_turno_devolucion"?: string,"p_venta_id": string }; Returns: undefined
                           },
"anular_venta_panel":
{ Args: { "p_motivo": string,"p_venta_id": string }; Returns: undefined
                           },
"apagar_ayudas":
{ Args: { "p_apagar": boolean }; Returns: undefined
                           },
"aplicar_aumento":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_motivo_sin_aviso"?: string,"p_planes": (string)[],"p_redondeo": number,"p_tipo": string,"p_valor": number }; Returns: number
                           },
"aprobar_pago":
{ Args: { "p_pago_id": string }; Returns: Json
                           },
"apto_config":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"apto_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"aptos_por_vencer":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"archivar_documento":
{ Args: { "p_clave": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"archivar_grado":
{ Args: { "p_grado_id": string }; Returns: undefined
                           },
"archivar_rutina":
{ Args: { "p_rutina_id": string }; Returns: undefined
                           },
"arreglar_falla":
{ Args: { "p_falla_id": string,"p_nota"?: string }; Returns: undefined
                           },
"asignar_convenio":
{ Args: { "p_convenio_id": string,"p_hasta"?: string,"p_socio_id": string }; Returns: undefined
                           },
"asignar_llavero":
{ Args: { "p_codigo": string,"p_socio_id": string }; Returns: undefined
                           },
"asignar_plan":
{ Args: { "p_plan_id": string,"p_socio_id": string }; Returns: string
                           },
"asignar_responsable_falla":
{ Args: { "p_falla_id": string,"p_responsable_id": string }; Returns: undefined
                           },
"asignar_rutina":
{ Args: { "p_rutina_id": string,"p_socio_id": string }; Returns: string
                           },
"asignar_rutina_varios":
{ Args: { "p_cambiar_en"?: string,"p_rutina_id": string,"p_socios": (string)[] }; Returns: Json
                           },
"asignar_servicio":
{ Args: { "p_asignar": boolean,"p_producto_id": string,"p_socio_id": string }; Returns: undefined
                           },
"asistencia_socio":
{ Args: { "p_mes"?: string,"p_socio_id": string }; Returns: Json
                           },
"aumentos_hechos":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"autoaltas_web":
{ Args: { "p_gimnasio_id": string }; Returns: number
                           },
"autonomia_socios_estado":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"autorizar_tablet":
{ Args: { "p_gimnasio_id": string,"p_nombre": string,"p_sede_id": string }; Returns: Json
                           },
"autoservicio_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"avisar_clase":
{ Args: { "p_clase_id": string,"p_texto": string }; Returns: Json
                           },
"avisar_sin_bloquear_estado":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"aviso_clase_socio":
{ Args: { "p_socio_id": string }; Returns: boolean
                           },
"aviso_clave_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"aviso_previo_aumento":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_planes": (string)[] }; Returns: Json
                           },
"avisos_app_socio":
{ Args: { "p_momento"?: string,"p_socio_id": string }; Returns: Json
                           },
"avisos_clase":
{ Args: { "p_clase_id": string }; Returns: Json
                           },
"avisos_lugar_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"avisos_pagos_mp":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"ayudas_vistas":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"baja_push":
{ Args: { "p_endpoint": string }; Returns: undefined
                           },
"bandeja_avisos":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"bandeja_mensajes":
{ Args: { "p_desde"?: number,"p_estado"?: string,"p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"beneficios_mes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"borrar_nota":
{ Args: { "p_nota_id": string }; Returns: undefined
                           },
"borrar_socios_ejemplo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"borrar_suscripcion_push":
{ Args: { "p_endpoint": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"borrar_tarea":
{ Args: { "p_tarea_id": string }; Returns: undefined
                           },
"buscar_socios":
{ Args: { "p_estado"?: string,"p_etiqueta"?: string,"p_gimnasio_id": string,"p_limite"?: number,"p_origen"?: string,"p_plan"?: string,"p_texto": string }; Returns: {
              "autoalta": boolean,"color": string,"dado_de_baja": boolean,"dejo_de_venir": boolean,"dni": string,"nombre": string,"numero": number,"plan": string,"puede": boolean,"socio_id": string,"telefono": string,"texto": string,"ultima_vez": string,"vence": string
            }[]
                           },
"buscar_socios_profe":
{ Args: { "p_gimnasio_id": string,"p_texto": string }; Returns: {
              "color": string,"nombre": string,"puede": boolean,"socio_id": string,"texto": string,"tiene_foto": boolean
            }[]
                           },
"caja_abierta":
{ Args: { "p_sede_id": string }; Returns: {
              "abierto_en": string,"abierto_por": string,"caja": string,"caja_id": string,"turno_id": string
            }[]
                           },
"caja_para_cobrar":
{ Args: { "p_sede_id": string }; Returns: Json
                           },
"cajas_olvidadas":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cajas_para_revisar":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cajas_sede":
{ Args: { "p_sede_id": string }; Returns: {
              "abierta_en": string,"abierta_por": string,"activa": boolean,"caja_id": string,"nombre": string,"turno_id": string,"vencida": boolean
            }[]
                           },
"calcular_devolucion_baja":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"cambiar_estado_hilo":
{ Args: { "p_estado": string,"p_hilo_id": string }; Returns: undefined
                           },
"cambiar_funcion_nueva":
{ Args: { "p_activa": boolean,"p_clave": string,"p_gimnasio_id": string }; Returns: Json
                           },
"cambiar_plan":
{ Args: { "p_plan_id": string,"p_socio_id": string }; Returns: string
                           },
"cambios_restaurables":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"campana":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"campana_control":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"campana_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"campana_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string }; Returns: Json
                           },
"cancelar_adhesion_debito":
{ Args: { "p_adhesion_id": string,"p_gimnasio_id": string }; Returns: undefined
                           },
"cancelar_clase":
{ Args: { "p_clase_id": string,"p_motivo": string }; Returns: number
                           },
"cancelar_inscripcion_evento":
{ Args: { "p_evento_id": string,"p_socio_id": string }; Returns: undefined
                           },
"cancelar_reserva":
{ Args: { "p_reserva_id": string }; Returns: string
                           },
"cancelar_sesion_pt":
{ Args: { "p_motivo"?: string,"p_sesion_id": string }; Returns: undefined
                           },
"cargar_apto":
{ Args: { "p_socio_id": string,"p_vence": string }; Returns: string
                           },
"cargar_franjas_pt":
{ Args: { "p_entrenador_id": string,"p_gimnasio_id": string,"p_inicio_local": string,"p_minutos": number,"p_repetir_semanas"?: number,"p_sede_id": string }; Returns: number
                           },
"cargar_gasto":
{ Args: { "p_categoria": string,"p_detalle": string,"p_fecha": string,"p_gimnasio_id": string,"p_monto": number }; Returns: string
                           },
"cargar_horas_profe":
{ Args: { "p_fecha": string,"p_gimnasio_id": string,"p_minutos": number,"p_nota"?: string,"p_profe_id": string }; Returns: string
                           },
"cargar_socios_ejemplo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cerrar_caja":
{ Args: { "p_billetes"?: Json,"p_monto_contado": number,"p_nota"?: string,"p_turno_id": string }; Returns: Json
                           },
"cerrar_emergencia_puerta":
{ Args: { "p_emergencia_id": string,"p_gimnasio_id": string }; Returns: Json
                           },
"cerrar_evento":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"cerrar_evento_webhook":
{ Args: { "p_error"?: string,"p_evento_id": string }; Returns: undefined
                           },
"cerrar_horario":
{ Args: { "p_desde"?: string,"p_horario_id": string }; Returns: undefined
                           },
"cerrar_novedad_plataforma":
{ Args: { "p_gimnasio_id": string,"p_id": string }; Returns: undefined
                           },
"checklist_hoy":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cierres_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"clase_detalle":
{ Args: { "p_clase_id": string }; Returns: Json
                           },
"clases_del_dia":
{ Args: { "p_dia": string,"p_sede_id": string,"p_socio_id"?: string }; Returns: {
              "actividad": string,"cancelada": boolean,"cancelada_motivo": string,"clase_id": string,"color": string,"confirmadas": number,"cupo": number,"emoji": string,"en_espera": number,"fin": string,"inicio": string,"mi_posicion": number,"mi_reserva": string,"profe": string,"profe_id": string
            }[]
                           },
"clases_para_probar":
{ Args: { "p_host": string }; Returns: Json
                           },
"clases_semana_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"cobradas_en_mostrador":
{ Args: { "p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"cobrar_cuota":
{ Args: { "p_cuotas"?: number,"p_medio": string,"p_sede_id": string,"p_socio_id": string,"p_turno_caja_id"?: string }; Returns: Json
                           },
"cobros_de_turnos":
{ Args: { "p_turno_ids": (string)[] }; Returns: Json
                           },
"comprobante_gasto":
{ Args: { "p_gasto_id": string }; Returns: string
                           },
"comprobante_venta":
{ Args: { "p_venta_id": string }; Returns: Json
                           },
"config_aumento":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_caja":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_cierres":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_clases_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_cobro":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_dejar_pasar":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_entrada":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_fichaje":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_liquidacion":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_prueba_gratis":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"config_turnos_fijos":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"config_visita":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"configuracion_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"configurar_stock":
{ Args: { "p_controla": boolean,"p_minimo"?: number,"p_producto_id": string }; Returns: undefined
                           },
"confirmar_comprobante_gasto":
{ Args: { "p_gasto_id": string,"p_ruta": string }; Returns: undefined
                           },
"confirmar_foto_falla":
{ Args: { "p_falla_id": string,"p_ruta": string }; Returns: undefined
                           },
"confirmar_foto_mensaje":
{ Args: { "p_mensaje_id": string,"p_ruta": string }; Returns: undefined
                           },
"confirmar_foto_producto":
{ Args: { "p_producto_id": string,"p_ruta": string }; Returns: undefined
                           },
"confirmar_foto_propia":
{ Args: { "p_ruta": string,"p_socio_id": string }; Returns: string
                           },
"confirmar_foto_socio":
{ Args: { "p_ruta": string,"p_socio_id": string }; Returns: string
                           },
"confirmar_foto_subida":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"confirmar_imagen_marca":
{ Args: { "p_gimnasio_id": string,"p_ruta": string,"p_tipo": string }; Returns: string
                           },
"confirmar_invitado":
{ Args: { "p_invitado_id": string,"p_sede_id": string }; Returns: undefined
                           },
"confirmar_remito_stock":
{ Args: { "p_producto_id": string,"p_ruta": string }; Returns: undefined
                           },
"confirmar_ticket":
{ Args: { "p_movimiento_id": string,"p_ruta": string }; Returns: undefined
                           },
"congelar":
{ Args: { "p_categoria": string,"p_desde": string,"p_hasta": string,"p_nota"?: string,"p_suscripcion_id": string }; Returns: string
                           },
"constancia_baja":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"contacto_plataforma_publico":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"contar_caja_sin_contar":
{ Args: { "p_billetes"?: Json,"p_monto_contado": number,"p_nota"?: string,"p_turno_id": string }; Returns: Json
                           },
"contar_stock":
{ Args: { "p_contado": number,"p_producto_id": string }; Returns: number
                           },
"contexto_cobro":
{ Args: { "p_sede_id": string,"p_socio_id": string }; Returns: Json
                           },
"contexto_pantalla":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"control_entrada":
{ Args: { "p_desde": string,"p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"convenio_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"convenios_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"copia_entrada":
{ Args: { "p_sede_id": string }; Returns: Json
                           },
"copiar_rutina":
{ Args: { "p_nombre"?: string,"p_rutina_id": string }; Returns: string
                           },
"corregir_fichaje":
{ Args: { "p_entrada_local": string,"p_fichaje_id": string,"p_motivo": string,"p_salida_local": string }; Returns: undefined
                           },
"corregir_incidente":
{ Args: { "p_donde": string,"p_incidente_id": string,"p_que_paso": string,"p_que_se_hizo": string,"p_testigos": string }; Returns: undefined
                           },
"cortesias_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"crear_cierre":
{ Args: { "p_compensa"?: boolean,"p_desde": string,"p_gimnasio_id": string,"p_hasta": string,"p_motivo": string,"p_sede_id"?: string }; Returns: string
                           },
"crear_cuenta_panel":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"crear_evento":
{ Args: { "p_borrador"?: boolean,"p_cupo": number,"p_descripcion"?: string,"p_fechas_extra"?: (string)[],"p_fin"?: string,"p_gimnasio_id": string,"p_inicio": string,"p_lista_espera"?: boolean,"p_lugar"?: string,"p_nombre": string,"p_para"?: string,"p_precio": number,"p_precio_socio"?: number,"p_responsable"?: string }; Returns: string
                           },
"crear_incidente":
{ Args: { "p_donde": string,"p_gimnasio_id": string,"p_ocurrio_en"?: string,"p_que_paso": string,"p_que_se_hizo": string,"p_socio_id"?: string,"p_testigos": string }; Returns: string
                           },
"crear_locker":
{ Args: { "p_gimnasio_id": string,"p_numero": string,"p_sede_id": string,"p_ubicacion"?: string }; Returns: string
                           },
"crear_lockers_serie":
{ Args: { "p_desde": number,"p_gimnasio_id": string,"p_hasta": number,"p_prefijo"?: string,"p_sede_id": string,"p_ubicacion"?: string }; Returns: number
                           },
"crear_maquina":
{ Args: { "p_gimnasio_id": string,"p_nombre": string,"p_sede_id": string }; Returns: string
                           },
"crear_prospecto":
{ Args: { "p_dni"?: string,"p_gimnasio_id": string,"p_interes"?: string,"p_nombre": string,"p_origen"?: string,"p_telefono": string }; Returns: string
                           },
"crear_tarea":
{ Args: { "p_dia": string,"p_gimnasio_id": string,"p_para": string,"p_que": string,"p_repite"?: string,"p_socio_id"?: string }; Returns: string
                           },
"crear_tv":
{ Args: { "p_gimnasio_id": string,"p_modo"?: string,"p_nombre": string,"p_sede_id": string }; Returns: Json
                           },
"credenciales_mp":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cuenta_para_clave_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"cuenta_para_nueva_clave":
{ Args: { "p_equipo_id": string }; Returns: Json
                           },
"cumplen_hoy":
{ Args: { "p_gimnasio_id": string,"p_momento"?: string }; Returns: Json
                           },
"cupo_dejar_pasar":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"cupones_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"dar_cortesia":
{ Args: { "p_dias": number,"p_motivo_id": string,"p_nota"?: string,"p_socio_id": string }; Returns: Json
                           },
"dar_de_baja":
{ Args: { "p_motivo": string,"p_socio_id": string }; Returns: Json
                           },
"dar_de_baja_equipo":
{ Args: { "p_equipo_id": string,"p_gimnasio_id": string,"p_motivo"?: string }; Returns: Json
                           },
"dar_de_baja_locker":
{ Args: { "p_activo": boolean,"p_locker_id": string }; Returns: undefined
                           },
"dar_de_baja_maquina":
{ Args: { "p_activa": boolean,"p_maquina_id": string }; Returns: undefined
                           },
"dar_prueba_gratis":
{ Args: { "p_apellido"?: string,"p_clase_id"?: string,"p_dni"?: string,"p_gimnasio_id": string,"p_nombre"?: string,"p_sede_id": string,"p_socio_id"?: string,"p_telefono"?: string }; Returns: Json
                           },
"datos_ejemplo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"datos_gimnasio_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"debito_estado":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"dejados_pasar":
{ Args: { "p_dia"?: string,"p_gimnasio_id": string }; Returns: Json
                           },
"dejar_caja_sin_contar":
{ Args: { "p_motivo": string,"p_turno_id": string }; Returns: Json
                           },
"desactivar_cupon":
{ Args: { "p_cupon_id": string }; Returns: undefined
                           },
"descongelar":
{ Args: { "p_congelamiento_id": string }; Returns: undefined
                           },
"deshacer_importacion":
{ Args: { "p_gimnasio_id": string,"p_importacion_id": string }; Returns: number
                           },
"desmarcar_dia_rutina":
{ Args: { "p_dia": number,"p_socio_id": string }; Returns: undefined
                           },
"destinos_push":
{ Args: { "p_evento": string,"p_id": string }; Returns: Json
                           },
"destinos_push_clases":
{ Args: { "p_evento": string,"p_id": string }; Returns: Json
                           },
"destinos_push_mensajes":
{ Args: { "p_evento": string,"p_id": string }; Returns: Json
                           },
"deuda_con_socios":
{ Args: { "p_gimnasio_id": string,"p_momento"?: string }; Returns: Json
                           },
"devolucion_baja_config":
{ Args: { "p_gimnasio_id": string }; Returns: string
                           },
"devoluciones_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"diferencia_caja_por_cajero":
{ Args: { "p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"documentos_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"documentos_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"documentos_socio_base":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"editar_horario":
{ Args: { "p_cupo": number,"p_duracion_min": number,"p_hora_inicio": string,"p_horario_id": string,"p_profe_id": string }; Returns: string
                           },
"editar_tarea":
{ Args: { "p_dia": string,"p_para": string,"p_que": string,"p_repite"?: string,"p_tarea_id": string }; Returns: undefined
                           },
"ejercicios_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"elegir_lugar":
{ Args: { "p_lugar": number,"p_reserva_id": string }; Returns: undefined
                           },
"encuesta_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"encuestas_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"entrada_stock":
{ Args: { "p_cantidad": number,"p_motivo"?: string,"p_producto_id": string }; Returns: number
                           },
"entradas_de_emergencia":
{ Args: { "p_emergencia_id": string,"p_gimnasio_id": string }; Returns: Json
                           },
"entradas_desde":
{ Args: { "p_desde"?: string,"p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"entrar_con_google":
{ Args: { "p_gimnasio_id": string,"p_usuario_id": string }; Returns: number
                           },
"entrar_con_pin":
{ Args: { "p_gimnasio_id": string,"p_pin": string }; Returns: Json
                           },
"entrar_por_qr_pared":
{ Args: { "p_codigo": string,"p_gimnasio_id": string,"p_momento"?: string,"p_socio_id": string }; Returns: Json
                           },
"equipo_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "activo": boolean,"equipo_id": string,"nombre": string,"rol": string,"sede": string,"sede_id": string,"soy_yo": boolean,"tiene_acceso": boolean
            }[]
                           },
"equipo_perfiles":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"escribir_al_gimnasio":
{ Args: { "p_motivo": string,"p_socio_id": string,"p_texto": string }; Returns: Json
                           },
"espera_plazo_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"estado_abono_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"estado_acceso":
{ Args: { "p_sede_id"?: string,"p_socio_id": string }; Returns: Database["public"]['CompositeTypes']["veredicto_acceso"]
                          SetofOptions: {
        from: "*"
        to: "veredicto_acceso"
        isOneToOne: true
        isSetofReturn: false
      } },
"estado_emergencia_puerta":
{ Args: { "p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"estado_gimnasio_aviso":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"estado_pagos_online":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"estado_soporte":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"estilo_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"etiquetas_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"evento_marcar_presente":
{ Args: { "p_evento_id": string,"p_inscripcion_id"?: string,"p_socio_id"?: string }; Returns: Json
                           },
"evento_quitar_presente":
{ Args: { "p_evento_id": string,"p_inscripcion_id"?: string,"p_socio_id"?: string }; Returns: undefined
                           },
"eventos_del_dia_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"eventos_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"eventos_publicos":
{ Args: { "p_host": string }; Returns: Json
                           },
"eventos_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"ex_socios":
{ Args: { "p_antiguedad"?: string,"p_gimnasio_id": string,"p_motivo"?: string }; Returns: Json
                           },
"exportar_gastos":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"exportar_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_tabla": string }; Returns: Json
                           },
"exportar_mes":
{ Args: { "p_gimnasio_id": string,"p_mes": string,"p_que": string }; Returns: Json
                           },
"exportar_socios":
{ Args: { "p_cantidad"?: number,"p_desde"?: number,"p_estado"?: string,"p_etiqueta"?: string,"p_gimnasio_id": string,"p_origen"?: string,"p_plan"?: string,"p_texto"?: string }; Returns: {
              "alta": string,"apellido": string,"cubierto_hasta": string,"dado_de_baja": string,"dni": string,"email": string,"estado": string,"etiquetas": string,"nacimiento": string,"nombre": string,"numero": number,"plan": string,"telefono": string
            }[]
                           },
"faltas_clase":
{ Args: { "p_clase_id": string }; Returns: Json
                           },
"faltas_socio":
{ Args: { "p_dias"?: number,"p_socio_id": string }; Returns: Json
                           },
"faltas_socio_detalle":
{ Args: { "p_dias"?: number,"p_socio_id": string }; Returns: Json
                           },
"familia_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"ficha_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"fichajes_persona":
{ Args: { "p_equipo_id": string,"p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"fichar":
{ Args: { "p_accion"?: string,"p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"fichar_con_pin":
{ Args: { "p_accion"?: string,"p_gimnasio_id": string,"p_pin": string }; Returns: Json
                           },
"fijar_titular_familia":
{ Args: { "p_socio_id": string,"p_tipo"?: string,"p_titular_id": string }; Returns: undefined
                           },
"filtros_socios":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"firmar_documento":
{ Args: { "p_documento_id": string,"p_nombre": string,"p_socio_id": string }; Returns: undefined
                           },
"firmas_propias_pendientes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"formas_de_entrada":
{ Args: { "p_gimnasio_id": string }; Returns: (string)[]
                           },
"foto_equipo":
{ Args: { "p_equipo_id": string }; Returns: string
                           },
"foto_estado_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"foto_falla":
{ Args: { "p_falla_id": string }; Returns: string
                           },
"foto_mensaje":
{ Args: { "p_mensaje_id": string }; Returns: string
                           },
"foto_propia":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"foto_propia_permitida":
{ Args: { "p_socio_id": string }; Returns: boolean
                           },
"foto_socio":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"foto_socio_permitida_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"fotos_de_clase":
{ Args: { "p_clase_id": string }; Returns: Json
                           },
"funcion_prendida":
{ Args: { "p_clave": string,"p_gimnasio_id": string }; Returns: boolean
                           },
"funciones_del_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"funciones_nuevas_activas":
{ Args: { "p_gimnasio_id": string }; Returns: (string)[]
                           },
"funciones_nuevas_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"ganancia_mes":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"gastos_mes":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"gimnasio_por_host":
{ Args: { "p_host": string }; Returns: {
              "color_acento": string,"color_fondo": string,"estilo": string,"favicon_path": string,"gimnasio_id": string,"logo_path": string,"modo": string,"nombre": string,"semaforo": boolean,"slug": string,"zona_horaria": string
            }[]
                           },
"gimnasio_por_slug":
{ Args: { "p_slug": string }; Returns: {
              "color_acento": string,"color_fondo": string,"estilo": string,"favicon_path": string,"gimnasio_id": string,"host": string,"logo_path": string,"modo": string,"nombre": string,"semaforo": boolean,"slug": string,"zona_horaria": string
            }[]
                           },
"grados_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"grados_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"guardar_accesos_rapidos":
{ Args: { "p_accesos": (string)[],"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_actividad":
{ Args: { "p_activa"?: boolean,"p_actividad_id": string,"p_descripcion"?: string,"p_emoji": string,"p_gimnasio_id": string,"p_nombre": string }; Returns: string
                           },
"guardar_actividades_plan":
{ Args: { "p_actividades": (string)[],"p_plan_id": string }; Returns: number
                           },
"guardar_ajustes_plan":
{ Args: { "p_datos": Json,"p_plan_id": string }; Returns: undefined
                           },
"guardar_alta_plan_sugerido":
{ Args: { "p_gimnasio_id": string,"p_plan_id": string }; Returns: Json
                           },
"guardar_altas":
{ Args: { "p_altas_online": boolean,"p_gimnasio_id": string,"p_reglamento": string }; Returns: Json
                           },
"guardar_apto_config":
{ Args: { "p_dias": number,"p_gimnasio_id": string,"p_modo": string }; Returns: Json
                           },
"guardar_autonomia_socios":
{ Args: { "p_gimnasio_id": string,"p_ocupacion_visible": boolean,"p_pausa_auto_max_dias": number,"p_pausa_autoaprobar": boolean }; Returns: Json
                           },
"guardar_avisar_sin_bloquear":
{ Args: { "p_dias": number,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_aviso_clase":
{ Args: { "p_si": boolean,"p_socio_id": string }; Returns: undefined
                           },
"guardar_checklist_item":
{ Args: { "p_activo"?: boolean,"p_gimnasio_id": string,"p_id"?: string,"p_momento": string,"p_texto": string }; Returns: string
                           },
"guardar_compras_app":
{ Args: { "p_activo": boolean,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_config_aumento":
{ Args: { "p_dias": number,"p_gimnasio_id": string }; Returns: number
                           },
"guardar_config_caja":
{ Args: { "p_fondo_fijo": number,"p_gimnasio_id": string,"p_hora_corte": string,"p_horas_max": number,"p_modo": string,"p_pedir_billetes": boolean }; Returns: Json
                           },
"guardar_config_cierres":
{ Args: { "p_gimnasio_id": string,"p_suma_dias": boolean }; Returns: Json
                           },
"guardar_config_cobro":
{ Args: { "p_gimnasio_id": string,"p_medio": string }; Returns: Json
                           },
"guardar_config_dejar_pasar":
{ Args: { "p_dias_max"?: number,"p_gimnasio_id": string,"p_modo": string }; Returns: Json
                           },
"guardar_config_entrada":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_config_fichaje":
{ Args: { "p_gimnasio_id": string,"p_tope_horas": number,"p_usa": boolean }; Returns: Json
                           },
"guardar_config_liquidacion":
{ Args: { "p_encargado_ve": boolean,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_config_pt":
{ Args: { "p_gimnasio_id": string,"p_horas": number }; Returns: undefined
                           },
"guardar_config_visita":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_configuracion":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_convenio":
{ Args: { "p_activo"?: boolean,"p_convenio_id": string,"p_gimnasio_id": string,"p_nombre": string,"p_tipo": string,"p_valor": number }; Returns: string
                           },
"guardar_crear_cuenta":
{ Args: { "p_gimnasio_id": string,"p_visible": boolean }; Returns: boolean
                           },
"guardar_cupon":
{ Args: { "p_codigo": string,"p_gimnasio_id": string,"p_planes"?: (string)[],"p_tipo": string,"p_tope_usos"?: number,"p_valor": number,"p_vence"?: string }; Returns: string
                           },
"guardar_datos_gimnasio":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_devolucion_baja_modo":
{ Args: { "p_gimnasio_id": string,"p_modo": string }; Returns: undefined
                           },
"guardar_doble_cobro":
{ Args: { "p_gimnasio_id": string,"p_minutos": number }; Returns: Json
                           },
"guardar_documento":
{ Args: { "p_clave": string,"p_gimnasio_id": string,"p_texto": string,"p_titulo": string }; Returns: string
                           },
"guardar_ejercicio":
{ Args: { "p_activo"?: boolean,"p_equipo"?: string,"p_gimnasio_id": string,"p_grupo": string,"p_id": string,"p_nombre": string,"p_video"?: string }; Returns: string
                           },
"guardar_equipo":
{ Args: { "p_activo"?: boolean,"p_equipo_id": string,"p_gimnasio_id": string,"p_nombre": string,"p_rol": string,"p_sede_id"?: string }; Returns: string
                           },
"guardar_equipo_ajuste":
{ Args: { "p_gimnasio_id": string,"p_mostrar": boolean }; Returns: undefined
                           },
"guardar_espera_plazo":
{ Args: { "p_gimnasio_id": string,"p_minutos": number }; Returns: undefined
                           },
"guardar_estilo_gimnasio":
{ Args: { "p_estilo": string,"p_gimnasio_id": string,"p_modo"?: string }; Returns: string
                           },
"guardar_estilo_pagina":
{ Args: { "p_color_acento": string,"p_color_fondo": string,"p_gimnasio_id": string,"p_tipografia": string }; Returns: Json
                           },
"guardar_ficha_producto":
{ Args: { "p_datos": Json,"p_producto_id": string }; Returns: undefined
                           },
"guardar_foto_equipo":
{ Args: { "p_equipo_id": string,"p_ruta": string }; Returns: string
                           },
"guardar_foto_socio_permitida":
{ Args: { "p_gimnasio_id": string,"p_si": boolean }; Returns: undefined
                           },
"guardar_gasto":
{ Args: { "p_categoria": string,"p_detalle": string,"p_gimnasio_id": string,"p_mes": string,"p_monto": number }; Returns: string
                           },
"guardar_gasto_fijo":
{ Args: { "p_categoria": string,"p_desde"?: string,"p_detalle": string,"p_gimnasio_id": string,"p_monto": number }; Returns: string
                           },
"guardar_grado":
{ Args: { "p_actividad_id": string,"p_clases_minimas"?: number,"p_color"?: string,"p_grado_id": string,"p_meses_minimos"?: number,"p_nombre": string,"p_orden": number }; Returns: string
                           },
"guardar_horarios_apertura":
{ Args: { "p_franjas": Json,"p_gimnasio_id": string,"p_sede_id": string }; Returns: undefined
                           },
"guardar_link_resena":
{ Args: { "p_gimnasio_id": string,"p_link": string }; Returns: undefined
                           },
"guardar_lugares":
{ Args: { "p_cantidad": number,"p_clase_id": string,"p_etiqueta"?: string,"p_fuera_servicio"?: (number)[] }; Returns: undefined
                           },
"guardar_matricula_plan":
{ Args: { "p_anual"?: boolean,"p_monto": number,"p_plan_id": string }; Returns: undefined
                           },
"guardar_medicion":
{ Args: { "p_gimnasio_id": string,"p_google_analytics": string,"p_pixel_meta": string }; Returns: Json
                           },
"guardar_mensaje":
{ Args: { "p_clave": string,"p_gimnasio_id": string,"p_texto": string }; Returns: undefined
                           },
"guardar_mercadopago":
{ Args: { "p_gimnasio_id": string,"p_modo": string,"p_secreto": string,"p_token": string }; Returns: undefined
                           },
"guardar_meta_visitas":
{ Args: { "p_gimnasio_id": string,"p_meta": number }; Returns: undefined
                           },
"guardar_mi_pin":
{ Args: { "p_gimnasio_id": string,"p_pin": string }; Returns: undefined
                           },
"guardar_motivo_beneficio":
{ Args: { "p_activo"?: boolean,"p_gimnasio_id": string,"p_id": string,"p_nombre": string }; Returns: string
                           },
"guardar_numeros_inicio":
{ Args: { "p_claves": (string)[],"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_pack_pt":
{ Args: { "p_activo"?: boolean,"p_entrenador_id": string,"p_gimnasio_id": string,"p_nombre": string,"p_precio": number,"p_producto_id": string,"p_sesiones": number,"p_validez_dias": number }; Returns: string
                           },
"guardar_pagina":
{ Args: { "p_gimnasio_id": string,"p_portada": Json,"p_secciones": Json }; Returns: Json
                           },
"guardar_perfil_equipo":
{ Args: { "p_actividades": (string)[],"p_equipo_id": string,"p_gimnasio_id": string,"p_horario": Json,"p_mostrar": boolean }; Returns: undefined
                           },
"guardar_permiso_gastos":
{ Args: { "p_gimnasio_id": string,"p_prendido": boolean }; Returns: undefined
                           },
"guardar_permisos_equipo":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_permisos_mensajes":
{ Args: { "p_gimnasio_id": string,"p_recepcion_ve": boolean }; Returns: undefined
                           },
"guardar_plan":
{ Args: { "p_datos": Json,"p_gimnasio_id": string,"p_plan_id": string }; Returns: string
                           },
"guardar_plan_familiar":
{ Args: { "p_activo": boolean,"p_gimnasio_id": string }; Returns: undefined
                           },
"guardar_politica_privacidad":
{ Args: { "p_gimnasio_id": string,"p_texto": string }; Returns: undefined
                           },
"guardar_preferencia_aviso":
{ Args: { "p_activo": boolean,"p_canal": string,"p_gimnasio_id": string,"p_tipo": string }; Returns: undefined
                           },
"guardar_presupuesto_gasto":
{ Args: { "p_categoria": string,"p_gimnasio_id": string,"p_monto": number }; Returns: undefined
                           },
"guardar_producto":
{ Args: { "p_activo"?: boolean,"p_gimnasio_id": string,"p_nombre": string,"p_precio": number,"p_producto_id": string }; Returns: string
                           },
"guardar_prueba_gratis":
{ Args: { "p_gimnasio_id": string,"p_modo": string }; Returns: Json
                           },
"guardar_prueba_social":
{ Args: { "p_cantidad": number,"p_gimnasio_id": string,"p_mostrar_socios": boolean,"p_puntaje": number }; Returns: Json
                           },
"guardar_registro_socios":
{ Args: { "p_abierto": boolean,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_regla_plan":
{ Args: { "p_dia_fijo"?: number,"p_plan_id": string,"p_renovacion"?: string,"p_usa_gimnasio": boolean }; Returns: Json
                           },
"guardar_regla_profe":
{ Args: { "p_gimnasio_id": string,"p_modo": string,"p_monto": number,"p_profe_id": string,"p_vigente_desde"?: string }; Returns: Json
                           },
"guardar_regla_vencimiento":
{ Args: { "p_datos": Json,"p_gimnasio_id": string }; Returns: Json
                           },
"guardar_respuesta_rapida":
{ Args: { "p_gimnasio_id": string,"p_id": string,"p_texto": string,"p_titulo": string }; Returns: string
                           },
"guardar_rutina":
{ Args: { "p_descripcion": string,"p_gimnasio_id": string,"p_id": string,"p_items": Json,"p_nombre": string }; Returns: string
                           },
"guardar_servicio":
{ Args: { "p_activo"?: boolean,"p_gimnasio_id": string,"p_nombre": string,"p_precio": number,"p_producto_id": string }; Returns: string
                           },
"guardar_socio":
{ Args: { "p_datos": Json,"p_gimnasio_id": string,"p_socio_id": string }; Returns: string
                           },
"guardar_suscripcion_push":
{ Args: { "p_auth": string,"p_endpoint": string,"p_gimnasio_id": string,"p_p256dh": string,"p_tipos"?: (string)[] }; Returns: undefined
                           },
"guardar_tarea_auto":
{ Args: { "p_activa": boolean,"p_clave": string,"p_dias"?: number,"p_gimnasio_id": string,"p_para_equipo"?: string,"p_para_rol"?: string }; Returns: undefined
                           },
"guardar_tarifa_locker":
{ Args: { "p_activo"?: boolean,"p_gimnasio_id": string,"p_meses": number,"p_nombre": string,"p_precio": number,"p_producto_id": string }; Returns: string
                           },
"guardar_tema_usuario":
{ Args: { "p_gimnasio_id": string,"p_tema": string }; Returns: string
                           },
"guardar_terminos":
{ Args: { "p_gimnasio_id": string,"p_publicado": boolean,"p_texto": string }; Returns: undefined
                           },
"guardar_topes_beneficios":
{ Args: { "p_alerta_repetidas": number,"p_dias_mes_encargado": number,"p_dias_mes_recepcion": number,"p_gimnasio_id": string,"p_max_dias_encargado": number,"p_max_dias_recepcion": number }; Returns: undefined
                           },
"guardar_turnos_fijos":
{ Args: { "p_gimnasio_id": string,"p_prendido": boolean }; Returns: undefined
                           },
"guardar_video_portada":
{ Args: { "p_gimnasio_id": string,"p_url": string }; Returns: string
                           },
"guardar_wod":
{ Args: { "p_clase_id": string,"p_texto": string }; Returns: undefined
                           },
"guia_entrada":
{ Args: { "p_sede_id"?: string,"p_socio_id": string }; Returns: Json
                           },
"habilitar_emergencia_puerta":
{ Args: { "p_gimnasio_id": string,"p_habilitada": boolean }; Returns: boolean
                           },
"hilo_mensajes":
{ Args: { "p_hilo_id": string }; Returns: Json
                           },
"historial_caja":
{ Args: { "p_limite"?: number,"p_sede_id": string }; Returns: Json
                           },
"historial_configuracion":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"historial_emergencias_puerta":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"historial_maquina":
{ Args: { "p_maquina_id": string }; Returns: Json
                           },
"historial_mensajes_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"horarios_apertura_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"horarios_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "actividad": string,"actividad_id": string,"cupo": number,"dia_semana": number,"duracion_min": number,"emoji": string,"hora_inicio": string,"horario_id": string,"profe": string,"profe_id": string,"sede": string,"sede_id": string,"vigente_desde": string,"vigente_hasta": string
            }[]
                           },
"horarios_para_turno":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"horas_equipo":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"importaciones_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"importar_socios":
{ Args: { "p_archivo"?: string,"p_filas": Json,"p_gimnasio_id": string }; Returns: Json
                           },
"incidentes_panel":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number,"p_socio_id"?: string }; Returns: Json
                           },
"info_gimnasio_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"informar_compra_app":
{ Args: { "p_clave_operacion"?: string,"p_comprobante_path": string,"p_plan_id": string,"p_socio_id": string }; Returns: Json
                           },
"informar_transferencia":
{ Args: { "p_clave_operacion"?: string,"p_comprobante_path": string,"p_cuotas"?: number,"p_socio_id": string }; Returns: Json
                           },
"ingreso_permitido":
{ Args: { "p_destino": string,"p_ip": string }; Returns: boolean
                           },
"ingresos_del_dia":
{ Args: { "p_dia"?: string,"p_gimnasio_id": string,"p_sede_id"?: string }; Returns: {
              "color": string,"ingreso_id": string,"momento": string,"numero": number,"registrado_por": string,"resultado": string,"socio": string,"socio_id": string,"texto": string,"via_acceso": string
            }[]
                           },
"ingresos_por_hora_y_dia":
{ Args: { "p_gimnasio_id": string,"p_semanas"?: number }; Returns: Json
                           },
"iniciar_compra_online":
{ Args: { "p_clave_operacion"?: string,"p_plan_id": string,"p_socio_id": string }; Returns: Json
                           },
"iniciar_pago_online":
{ Args: { "p_clave_operacion"?: string,"p_socio_id": string }; Returns: Json
                           },
"inicio_semaforo":
{ Args: { "p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"inscribirse_evento":
{ Args: { "p_evento_id": string,"p_socio_id": string }; Returns: Json
                           },
"inscribirse_evento_publico":
{ Args: { "p_dni": string,"p_evento_id": string,"p_host": string,"p_nombre": string,"p_telefono": string }; Returns: Json
                           },
"invitado_a_interesado":
{ Args: { "p_invitado_id": string,"p_whatsapp": string }; Returns: string
                           },
"invitados_de_hoy":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"invitados_sin_seguimiento":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"invitar":
{ Args: { "p_dni": string,"p_gimnasio_id": string,"p_nombre": string,"p_socio_id": string }; Returns: string
                           },
"kiosco_alta":
{ Args: { "p_token": string }; Returns: string
                           },
"kiosco_emergencia":
{ Args: { "p_token": string }; Returns: Json
                           },
"kiosco_entrar":
{ Args: { "p_codigo": string,"p_token": string }; Returns: Json
                           },
"kiosco_entrar_habitual":
{ Args: { "p_dni_fin": string,"p_socio_id": string,"p_token": string }; Returns: Json
                           },
"kiosco_estado":
{ Args: { "p_token": string }; Returns: Json
                           },
"kiosco_habituales":
{ Args: { "p_token": string }; Returns: Json
                           },
"kiosco_qr":
{ Args: { "p_momento"?: string,"p_token": string }; Returns: Json
                           },
"kiosco_salida_activa":
{ Args: { "p_token": string }; Returns: boolean
                           },
"kiosco_salir":
{ Args: { "p_codigo": string,"p_token": string }; Returns: Json
                           },
"kiosco_ultimo":
{ Args: { "p_desde": string,"p_token": string }; Returns: Json
                           },
"landing_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"landing_publica_base":
{ Args: { "p_host": string }; Returns: Json
                           },
"landing_publica_sin_cuenta":
{ Args: { "p_host": string }; Returns: Json
                           },
"leer_campana":
{ Args: { "p_claves": (string)[],"p_gimnasio_id": string }; Returns: number
                           },
"leer_llavero":
{ Args: { "p_codigo": string,"p_gimnasio_id": string }; Returns: Json
                           },
"leer_qr":
{ Args: { "p_codigo": string,"p_gimnasio_id": string,"p_momento"?: string }; Returns: Json
                           },
"levantar_suspension":
{ Args: { "p_motivo": string,"p_suspension_id": string }; Returns: undefined
                           },
"liberar_locker":
{ Args: { "p_locker_id": string,"p_motivo": string }; Returns: undefined
                           },
"linea_de_control":
{ Args: { "p_cursor"?: string,"p_desde": string,"p_gimnasio_id": string,"p_hasta": string,"p_limite"?: number,"p_quien"?: string,"p_tipos"?: (string)[] }; Returns: Json
                           },
"liquidacion_profe_detalle":
{ Args: { "p_gimnasio_id": string,"p_mes": string,"p_profe_id": string }; Returns: Json
                           },
"liquidacion_profes":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"lista_clase":
{ Args: { "p_clase_id": string }; Returns: {
              "estado": string,"nombre": string,"posicion": number,"presente": boolean,"socio_id": string,"telefono": string
            }[]
                           },
"lista_precios_plan":
{ Args: { "p_plan_id": string }; Returns: Json
                           },
"llavero_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"lockers_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"lockers_vencen_semana":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"lote_lecturas":
{ Args: { "p_llamadas": Json }; Returns: Json
                           },
"lugares_clase":
{ Args: { "p_clase_id": string,"p_socio_id"?: string }; Returns: Json
                           },
"mail_para_ingresar":
{ Args: { "p_email": string,"p_gimnasio_id": string }; Returns: Json
                           },
"mantenimiento_vigente":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"maquinas_fuera_de_servicio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"maquinas_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"marcar_alertas_vistas":
{ Args: { "p_gimnasio_id": string }; Returns: number
                           },
"marcar_avisado":
{ Args: { "p_clave": string,"p_referencia": string,"p_socio_id": string }; Returns: undefined
                           },
"marcar_aviso_clave_visto":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"marcar_aviso_leido":
{ Args: { "p_aviso_id": string }; Returns: undefined
                           },
"marcar_ayuda":
{ Args: { "p_clave": string }; Returns: boolean
                           },
"marcar_bienvenida":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"marcar_dia_rutina":
{ Args: { "p_dia": number,"p_socio_id": string }; Returns: Json
                           },
"marcar_no_escribirle":
{ Args: { "p_marcar": boolean,"p_motivo": string,"p_socio_id": string }; Returns: Json
                           },
"marcar_plantilla":
{ Args: { "p_plantilla": boolean,"p_rutina_id": string }; Returns: undefined
                           },
"marcar_serie_rutina":
{ Args: { "p_dia": number,"p_ejercicio_id": string,"p_hecha"?: boolean,"p_serie": number,"p_socio_id": string }; Returns: Json
                           },
"marcar_sesion_pt":
{ Args: { "p_resultado": string,"p_sesion_id": string }; Returns: undefined
                           },
"marcar_tarea":
{ Args: { "p_hecha": boolean,"p_tarea_id": string }; Returns: undefined
                           },
"marcar_transferencia_vista":
{ Args: { "p_pago_id": string,"p_vista"?: boolean }; Returns: Json
                           },
"matriculas_planes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"medicion_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"medicion_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"mensajes_estado_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mensajes_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"mensajes_sin_responder":
{ Args: { "p_gimnasio_id": string }; Returns: number
                           },
"meta_visitas_panel":
{ Args: { "p_gimnasio_id": string }; Returns: number
                           },
"mi_dni":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"mi_fichaje":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"mi_hilo":
{ Args: { "p_hilo_id": string }; Returns: Json
                           },
"mi_historial":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mi_link_referido":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mi_liquidacion":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"mi_locker":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mi_qr":
{ Args: { "p_gimnasio_id": string,"p_momento"?: string,"p_socio_id": string }; Returns: Json
                           },
"mi_seguridad":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mi_sesion":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mi_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id"?: string }; Returns: Json
                           },
"mi_tema":
{ Args: { "p_gimnasio_id": string }; Returns: string
                           },
"mi_turno_caja":
{ Args: { "p_sede_id": string }; Returns: Json
                           },
"mis_avisos":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mis_datos":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"mis_horas":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: Json
                           },
"mis_invitados":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string }; Returns: Json
                           },
"mis_mensajes":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"moderacion_control":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_hasta": string,"p_limite"?: number }; Returns: Json
                           },
"motivo_reserva":
{ Args: { "p_clase_id": string,"p_socio_id": string }; Returns: Json
                           },
"motivos_baja_mes":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"motivos_beneficio_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"motivos_reserva":
{ Args: { "p_clase_ids": (string)[],"p_socio_id": string }; Returns: Json
                           },
"movimiento_caja":
{ Args: { "p_monto": number,"p_motivo": string,"p_tipo": string,"p_turno_id": string }; Returns: string
                           },
"movimientos_stock_producto":
{ Args: { "p_producto_id": string }; Returns: Json
                           },
"movimientos_turno":
{ Args: { "p_turno_id": string }; Returns: Json
                           },
"no_escribirle_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"no_escribirles_de":
{ Args: { "p_gimnasio_id": string,"p_socio_ids": (string)[] }; Returns: (string)[]
                           },
"notas_y_etiquetas":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"novedades_dueno":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"novedades_historial":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"novedades_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"novedades_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"numeros_inicio":
{ Args: { "p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"ocultar_primeros_pasos":
{ Args: { "p_gimnasio_id": string,"p_ocultar": boolean }; Returns: undefined
                           },
"ocupacion_en_vivo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"ocupacion_horarios":
{ Args: { "p_gimnasio_id": string,"p_semanas"?: number }; Returns: Json
                           },
"ofertas_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"opciones_compra_app":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"operador_actual":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"ordenar_fotos":
{ Args: { "p_gimnasio_id": string,"p_rutas": (string)[] }; Returns: undefined
                           },
"ordenar_planes":
{ Args: { "p_gimnasio_id": string,"p_ids": (string)[] }; Returns: undefined
                           },
"origen_alta_socio":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"origen_altas_reporte":
{ Args: { "p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"origen_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"otorgar_grado":
{ Args: { "p_fecha"?: string,"p_grado_id": string,"p_socio_id": string }; Returns: string
                           },
"pagar_profe":
{ Args: { "p_clave"?: string,"p_gimnasio_id": string,"p_medio": string,"p_mes": string,"p_monto": number,"p_nota"?: string,"p_profe_id": string,"p_turno_id"?: string }; Returns: string
                           },
"pagina_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pagina_por_defecto":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pago_online":
{ Args: { "p_pago_id": string }; Returns: Json
                           },
"pago_online_disponible":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"pago_online_revisable":
{ Args: { "p_pago_id": string }; Returns: Json
                           },
"pagos_por_aprobar":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "comprobante_path": string,"descripcion": string,"informado_en": string,"medio": string,"monto": number,"pago_id": string,"socio": string,"socio_id": string,"venta_id": string
            }[]
                           },
"panel_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"panel_inicio":
{ Args: { "p_gimnasio_id": string,"p_sede_id"?: string }; Returns: Json
                           },
"panel_vivo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"para_hacer_hoy":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pasos_asistente":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pausas_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"pedido_baja_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"pedidos_anulacion_pendientes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pedidos_baja_pendientes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pedidos_datos_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pedidos_pausa_pendientes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pedir_anulacion":
{ Args: { "p_motivo": string,"p_venta_id": string }; Returns: string
                           },
"pedir_ayuda_brik":
{ Args: { "p_error"?: string,"p_gimnasio_id": string,"p_mensaje": string,"p_pantalla"?: string }; Returns: string
                           },
"pedir_baja_socio":
{ Args: { "p_motivo": string,"p_nota"?: string,"p_socio_id": string }; Returns: string
                           },
"pedir_demo_brik":
{ Args: { "p_contacto": string,"p_gimnasio": string,"p_mensaje"?: string,"p_nombre": string }; Returns: Json
                           },
"pedir_mis_datos":
{ Args: { "p_detalle"?: string,"p_socio_id": string,"p_tipo": string }; Returns: string
                           },
"pedir_pausa":
{ Args: { "p_categoria": string,"p_desde": string,"p_hasta": string,"p_nota"?: string,"p_suscripcion_id": string }; Returns: string
                           },
"pedir_pausa_socio":
{ Args: { "p_categoria": string,"p_desde": string,"p_hasta": string,"p_nota"?: string,"p_socio_id": string }; Returns: string
                           },
"pendientes_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"perdonar_bloqueo":
{ Args: { "p_motivo": string,"p_socio_id": string }; Returns: Json
                           },
"perdonar_falta":
{ Args: { "p_clase_id": string,"p_motivo": string,"p_socio_id": string }; Returns: Json
                           },
"periodo_alta_propuesto":
{ Args: { "p_fecha_alta": string,"p_fecha_pago": string,"p_gimnasio_id": string,"p_plan_id": string }; Returns: Json
                           },
"periodo_cuota_propuesto":
{ Args: { "p_sede_id": string,"p_socio_id": string }; Returns: Json
                           },
"permisos_equipo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"permisos_mensajes":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"persona_para_dar_acceso":
{ Args: { "p_equipo_id": string }; Returns: Json
                           },
"pestanas_app":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"plan_familiar_estado":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"plan_familiar_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"planes_brik_publicos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"planes_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "activo": boolean,"cantidad_clases": number,"consume_en": string,"descripcion": string,"duracion_meses": number,"hora_desde": string,"hora_hasta": string,"max_ingresos_semana": number,"nombre": string,"orden": number,"plan_id": string,"precio": number,"proximo_desde": string,"proximo_precio": number,"renovacion": string,"socios_activos": number,"tipo": string,"validez_dias": number,"visible_en_landing": boolean
            }[]
                           },
"planes_para_alta":
{ Args: { "p_sede_id": string }; Returns: Json
                           },
"politica_privacidad_propia":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"politica_privacidad_publica":
{ Args: { "p_host": string }; Returns: Json
                           },
"politica_reservas":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"poner_etiqueta":
{ Args: { "p_nombre": string,"p_socio_id": string }; Returns: string
                           },
"posibles_duplicados":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"precio_cuota":
{ Args: { "p_medio": string,"p_sede_id"?: string,"p_socio_id": string }; Returns: number
                           },
"precios_venta":
{ Args: { "p_sede_id": string,"p_socio_id"?: string }; Returns: Json
                           },
"preferencias_aviso_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"preparar_comprobante_gasto":
{ Args: { "p_ext": string,"p_gasto_id": string }; Returns: string
                           },
"preparar_foto_equipo":
{ Args: { "p_equipo_id": string,"p_ext": string }; Returns: string
                           },
"preparar_foto_falla":
{ Args: { "p_ext": string,"p_falla_id": string }; Returns: string
                           },
"preparar_foto_mensaje":
{ Args: { "p_ext": string,"p_mensaje_id": string }; Returns: string
                           },
"preparar_foto_producto":
{ Args: { "p_ext": string,"p_producto_id": string }; Returns: string
                           },
"preparar_foto_propia":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"preparar_foto_socio":
{ Args: { "p_socio_id": string }; Returns: string
                           },
"preparar_imagen_marca":
{ Args: { "p_bytes": number,"p_gimnasio_id": string,"p_tipo": string,"p_tipo_mime": string }; Returns: string
                           },
"preparar_remito_stock":
{ Args: { "p_ext": string,"p_producto_id": string }; Returns: string
                           },
"preparar_ticket":
{ Args: { "p_ext": string,"p_movimiento_id": string }; Returns: string
                           },
"previsualizar_cierre":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_hasta": string,"p_sede_id"?: string }; Returns: Json
                           },
"primer_mes_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"primeros_pasos":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"productos_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "activo": boolean,"nombre": string,"orden": number,"precio": number,"producto_id": string
            }[]
                           },
"productos_mostrador":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"profes_de_clases":
{ Args: { "p_clase_ids": (string)[] }; Returns: Json
                           },
"programar_lista_precios":
{ Args: { "p_desde"?: string,"p_general": number,"p_plan_id": string,"p_variantes": Json }; Returns: string
                           },
"programar_precio":
{ Args: { "p_desde"?: string,"p_monto": number,"p_plan_id": string }; Returns: string
                           },
"progreso_inicio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"progreso_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"prometieron_pagar":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"prospecto_es_socio":
{ Args: { "p_gimnasio_id": string,"p_prospecto_id": string,"p_socio_id": string }; Returns: undefined
                           },
"prospecto_por_dni":
{ Args: { "p_dni": string,"p_gimnasio_id": string }; Returns: Json
                           },
"prospecto_por_telefono":
{ Args: { "p_gimnasio_id": string,"p_telefono": string }; Returns: Json
                           },
"prospectos_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"prueba_por_dni":
{ Args: { "p_dni": string,"p_gimnasio_id": string }; Returns: Json
                           },
"prueba_social_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"pt_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"publicar_evento":
{ Args: { "p_evento_id": string }; Returns: undefined
                           },
"publicar_novedad":
{ Args: { "p_gimnasio_id": string,"p_hasta": string,"p_texto": string }; Returns: string
                           },
"publicar_pagina":
{ Args: { "p_gimnasio_id": string,"p_publicada": boolean }; Returns: undefined
                           },
"qr_alta_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"que_hay_de_nuevo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"quiero_probar":
{ Args: { "p_host": string,"p_interes"?: string,"p_nombre": string,"p_ref"?: string,"p_telefono": string }; Returns: Json
                           },
"quitar_convenio":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"quitar_foto_producto":
{ Args: { "p_producto_id": string }; Returns: undefined
                           },
"quitar_franja_pt":
{ Args: { "p_franja_id": string,"p_motivo"?: string }; Returns: Json
                           },
"quitar_gasto":
{ Args: { "p_gasto_id": string }; Returns: undefined
                           },
"quitar_imagen_marca":
{ Args: { "p_gimnasio_id": string,"p_ruta"?: string,"p_tipo": string }; Returns: string
                           },
"quitar_llavero":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"quitar_mercadopago":
{ Args: { "p_gimnasio_id": string }; Returns: undefined
                           },
"quitar_novedad":
{ Args: { "p_novedad_id": string }; Returns: undefined
                           },
"quitar_respuesta_rapida":
{ Args: { "p_gimnasio_id": string,"p_id": string }; Returns: undefined
                           },
"quitar_rutina_socio":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"quitar_titular_familia":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"quitar_turno":
{ Args: { "p_turno_id": string }; Returns: undefined
                           },
"racha_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"rechazar_oferta":
{ Args: { "p_reserva_id": string }; Returns: undefined
                           },
"rechazar_pago":
{ Args: { "p_motivo": string,"p_pago_id": string }; Returns: undefined
                           },
"recibo_venta":
{ Args: { "p_venta_id": string }; Returns: Json
                           },
"reemplazar_profe":
{ Args: { "p_clase_id": string,"p_motivo": string,"p_profe_id": string }; Returns: Json
                           },
"reemplazos_clase":
{ Args: { "p_clase_id": string }; Returns: Json
                           },
"registra_salida":
{ Args: { "p_gimnasio_id": string }; Returns: string
                           },
"registrar_adhesion_debito":
{ Args: { "p_gimnasio_id": string,"p_monto": number,"p_mp_suscripcion_id": string,"p_socio_id": string }; Returns: string
                           },
"registrar_clave_entregada":
{ Args: { "p_cuenta_creada"?: boolean,"p_equipo_id"?: string,"p_socio_id"?: string }; Returns: undefined
                           },
"registrar_contacto":
{ Args: { "p_canal"?: string,"p_lista": string,"p_nota"?: string,"p_resultado"?: string,"p_socio_id": string }; Returns: string
                           },
"registrar_devolucion":
{ Args: { "p_medio": string,"p_monto": number,"p_motivo": string,"p_socio_id": string }; Returns: Json
                           },
"registrar_envio_publico":
{ Args: { "p_clave"?: string,"p_formulario": string,"p_ip": string }; Returns: undefined
                           },
"registrar_error_app":
{ Args: { "p_gimnasio_id": string,"p_mensaje": string,"p_pantalla": string }; Returns: undefined
                           },
"registrar_evento_webhook":
{ Args: { "p_gimnasio_id": string,"p_id_externo": string,"p_origen": string,"p_payload": Json,"p_tipo": string }; Returns: Json
                           },
"registrar_ingreso":
{ Args: { "p_dispositivo_id"?: string,"p_forzar_motivo"?: string,"p_promete_pagar_el"?: string,"p_sede_id": string,"p_socio_id": string,"p_via_acceso"?: string }; Returns: Json
                           },
"registrar_ingreso_fallido":
{ Args: { "p_destino": string,"p_ip": string }; Returns: undefined
                           },
"registrar_invitado":
{ Args: { "p_dni": string,"p_gimnasio_id": string,"p_nombre": string,"p_sede_id": string,"p_socio_id": string }; Returns: string
                           },
"registrar_pedido_codigo":
{ Args: { "p_destino": string,"p_ip": string }; Returns: undefined
                           },
"registrar_salida":
{ Args: { "p_dispositivo_id"?: string,"p_sede_id": string,"p_socio_id": string,"p_via_acceso"?: string }; Returns: Json
                           },
"registrar_sesion_equipo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"registrar_uso_cupon":
{ Args: { "p_codigo": string,"p_venta_id": string }; Returns: undefined
                           },
"registro_socios_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"reglamento_aceptado":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"reglas_beneficios":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"reglas_vencimiento":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"reiniciar_ayudas":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"remito_stock":
{ Args: { "p_movimiento_id": string }; Returns: string
                           },
"renovar_alquiler_locker":
{ Args: { "p_alquiler_id": string,"p_meses"?: number,"p_motivo"?: string,"p_venta_item_id"?: string }; Returns: string
                           },
"repetir_gastos":
{ Args: { "p_gimnasio_id": string,"p_mes": string }; Returns: number
                           },
"reportar_falla":
{ Args: { "p_maquina_id": string,"p_motivo": string,"p_responsable_id"?: string }; Returns: string
                           },
"reporte_dia":
{ Args: { "p_dia"?: string,"p_sede_id": string }; Returns: Json
                           },
"reporte_turno":
{ Args: { "p_turno_id": string }; Returns: Json
                           },
"reservar":
{ Args: { "p_clase_id": string,"p_socio_id": string }; Returns: Json
                           },
"reservar_prueba_publica":
{ Args: { "p_clase_id": string,"p_dni": string,"p_host": string,"p_nombre": string,"p_telefono": string }; Returns: Json
                           },
"reservar_sesion_pt":
{ Args: { "p_franja_id": string,"p_socio_id": string }; Returns: Json
                           },
"resolver_pedido_anulacion":
{ Args: { "p_aprobar": boolean,"p_pedido_id": string,"p_respuesta"?: string }; Returns: undefined
                           },
"resolver_pedido_baja":
{ Args: { "p_dar_de_baja": boolean,"p_pedido_id": string }; Returns: undefined
                           },
"resolver_pedido_datos":
{ Args: { "p_nota"?: string,"p_pedido_id": string }; Returns: undefined
                           },
"resolver_pedido_pausa":
{ Args: { "p_aprobar": boolean,"p_pedido_id": string }; Returns: undefined
                           },
"responder_encuesta":
{ Args: { "p_puntaje": number,"p_socio_id": string }; Returns: Json
                           },
"responder_hilo_socio":
{ Args: { "p_hilo_id": string,"p_texto": string }; Returns: Json
                           },
"responder_mensaje":
{ Args: { "p_hilo_id": string,"p_texto": string }; Returns: Json
                           },
"respuestas_rapidas":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"restaurar_cambio_configuracion":
{ Args: { "p_cambio_id": string,"p_gimnasio_id": string }; Returns: Json
                           },
"restaurar_mensaje":
{ Args: { "p_clave": string,"p_gimnasio_id": string }; Returns: string
                           },
"resultado_mes":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"resultado_por_sede":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"resumen_app_socio":
{ Args: { "p_momento"?: string,"p_socio_id": string }; Returns: Json
                           },
"resumen_caja":
{ Args: { "p_turno_id": string }; Returns: Json
                           },
"resumen_dueno":
{ Args: { "p_desde"?: string,"p_dias"?: number,"p_gimnasio_id": string }; Returns: Json
                           },
"resumen_noche":
{ Args: { "p_dia"?: string,"p_gimnasio_id": string }; Returns: Json
                           },
"retencion":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "debe": number,"dias": number,"lista": string,"mensaje": string,"monto_mensual": number,"nombre": string,"socio_id": string,"telefono": string,"texto": string,"ultimo_contacto_en": string,"ultimo_contacto_por": string,"ultimo_contacto_resultado": string,"ultimo_ingreso": string,"vence_en": string,"visitas_por_semana": number
            }[]
                           },
"retencion_numeros":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"retencion_periodo":
{ Args: { "p_gimnasio_id": string,"p_periodo"?: string }; Returns: Json
                           },
"retencion_resumen":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"revertir_pago_mp":
{ Args: { "p_estado": string,"p_fecha"?: string,"p_mp_pago_id": string,"p_pago_id": string }; Returns: string
                           },
"revisar_importacion":
{ Args: { "p_filas": Json,"p_gimnasio_id": string }; Returns: Json
                           },
"revisar_pagos_mp":
{ Args: { "p_gimnasio_id": string,"p_pago_id"?: string }; Returns: Json
                           },
"revisar_suspension":
{ Args: { "p_revisar_el": string,"p_suspension_id": string }; Returns: undefined
                           },
"revocar_tablet":
{ Args: { "p_dispositivo_id": string }; Returns: undefined
                           },
"revocar_tv":
{ Args: { "p_id": string }; Returns: undefined
                           },
"riesgo_baja":
{ Args: { "p_gimnasio_id": string,"p_socio_id"?: string }; Returns: Json
                           },
"rutina_de_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"rutina_detalle":
{ Args: { "p_rutina_id": string }; Returns: Json
                           },
"rutinas_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"rutinas_progreso_equipo":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"sacar_de_familia":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"sacar_etiqueta":
{ Args: { "p_etiqueta_id": string,"p_socio_id": string }; Returns: undefined
                           },
"salir_por_qr_pared":
{ Args: { "p_codigo": string,"p_gimnasio_id": string,"p_momento"?: string,"p_socio_id": string }; Returns: Json
                           },
"seguridad_dueno":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"series_hechas_hoy":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"servicios_gimnasio":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"sesiones_dictadas_pt":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_hasta": string }; Returns: Json
                           },
"simular_cuota":
{ Args: { "p_dia": string,"p_gimnasio_id": string,"p_plan_id": string }; Returns: Json
                           },
"sincronizar_sin_internet":
{ Args: { "p_entradas": Json,"p_sede_id": string }; Returns: Json
                           },
"slug_actual_de":
{ Args: { "p_slug": string }; Returns: string
                           },
"socio_para_reclamar":
{ Args: { "p_dni": string,"p_gimnasio_id": string,"p_telefono": string }; Returns: Json
                           },
"socio_para_vincular_google":
{ Args: { "p_dni": string,"p_gimnasio_id": string }; Returns: Json
                           },
"socios_con_etiqueta":
{ Args: { "p_etiqueta_id": string,"p_gimnasio_id": string }; Returns: (string)[]
                           },
"soportes_del_gimnasio":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"stock_productos":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"sumar_sede":
{ Args: { "p_gimnasio_id": string,"p_nombre": string }; Returns: string
                           },
"suscripcion_push":
{ Args: { "p_endpoint"?: string,"p_gimnasio_id": string }; Returns: Json
                           },
"suspender_socio":
{ Args: { "p_hasta"?: string,"p_motivo": string,"p_revisar_el"?: string,"p_socio_id": string,"p_tipo"?: string }; Returns: string
                           },
"suspension_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"tablero_retencion":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"tablets_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"tareas_auto_config":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"tareas_panel":
{ Args: { "p_gimnasio_id": string,"p_todas"?: boolean }; Returns: Json
                           },
"tasa_de_cobro":
{ Args: { "p_gimnasio_id": string,"p_mes"?: string }; Returns: Json
                           },
"telefono_para_ingresar":
{ Args: { "p_texto": string }; Returns: string
                           },
"terminar_gasto_fijo":
{ Args: { "p_desde_mes": string,"p_fijo_id": string }; Returns: undefined
                           },
"terminos_propios":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"terminos_publicos":
{ Args: { "p_host": string }; Returns: Json
                           },
"ticket_movimiento":
{ Args: { "p_movimiento_id": string }; Returns: string
                           },
"tildar_checklist":
{ Args: { "p_hecha": boolean,"p_item_id": string }; Returns: undefined
                           },
"tomar_asistencia":
{ Args: { "p_clase_id": string,"p_socio_id": string }; Returns: Json
                           },
"turnos_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           },
"tv_estado":
{ Args: { "p_token": string }; Returns: Json
                           },
"tvs_panel":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"ultimas_entradas":
{ Args: { "p_gimnasio_id": string,"p_limite"?: number }; Returns: Json
                           },
"unir_socios":
{ Args: { "p_gimnasio_id": string,"p_queda": string,"p_se_va": string }; Returns: undefined
                           },
"usa_qr_pared":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"usuario_por_mail":
{ Args: { "p_email": string }; Returns: string
                           },
"validar_cupon":
{ Args: { "p_codigo": string,"p_gimnasio_id": string }; Returns: Json
                           },
"valor_del_socio":
{ Args: { "p_gimnasio_id": string,"p_momento"?: string }; Returns: Json
                           },
"vencen_hoy":
{ Args: { "p_gimnasio_id": string }; Returns: {
              "mensaje": string,"monto_mensual": number,"nombre": string,"socio_id": string,"telefono": string,"texto": string,"ultimo_contacto_en": string,"ultimo_contacto_por": string,"ultimo_ingreso": string
            }[]
                           },
"vencen_pestanas":
{ Args: { "p_gimnasio_id": string }; Returns: Json
                           },
"vender":
{ Args: { "p_clave_operacion"?: string,"p_cobrado_en"?: string,"p_comprobante_path"?: string,"p_confirmar"?: boolean,"p_items": Json,"p_motivo_doble"?: string,"p_motivo_otro_dia"?: string,"p_pagos": Json,"p_sede_id": string,"p_socio_id"?: string,"p_turno_id"?: string }; Returns: Json
                           },
"ventas_socio":
{ Args: { "p_limite"?: number,"p_socio_id": string }; Returns: Json
                           },
"ver_mensajes_equipo":
{ Args: { "p_gimnasio_id": string }; Returns: boolean
                           },
"verificar_version":
{ Args: { "p_gimnasio_id": string,"p_id": string,"p_tabla": string,"p_version": string }; Returns: Json
                           },
"version_registro":
{ Args: { "p_gimnasio_id": string,"p_id": string,"p_tabla": string }; Returns: Json
                           },
"vincular_cuenta_socio":
{ Args: { "p_gimnasio_id": string,"p_socio_id": string,"p_usuario_id": string }; Returns: undefined
                           },
"vincular_familia":
{ Args: { "p_otro_id": string,"p_socio_id": string }; Returns: undefined
                           },
"vincular_google":
{ Args: { "p_confirmar"?: boolean,"p_dni": string,"p_gimnasio_id": string,"p_usuario_id": string,"p_verificado_id": string }; Returns: Json
                           },
"vincular_socios_por_email":
{ Args: { "p_gimnasio_id": string,"p_usuario_id": string }; Returns: Json
                           },
"vincular_socios_por_telefono":
{ Args: { "p_gimnasio_id": string,"p_usuario_id": string }; Returns: number
                           },
"vincular_usuario_equipo":
{ Args: { "p_equipo_id": string,"p_usuario_id": string }; Returns: undefined
                           },
"vista_aumento":
{ Args: { "p_desde": string,"p_gimnasio_id": string,"p_planes": (string)[],"p_redondeo": number,"p_tipo": string,"p_valor": number }; Returns: Json
                           },
"vista_cambio_plan":
{ Args: { "p_plan_id": string,"p_socio_id": string }; Returns: Json
                           },
"vista_compra_app":
{ Args: { "p_plan_id": string,"p_socio_id": string }; Returns: Json
                           },
"vista_previa_mensaje":
{ Args: { "p_clave": string,"p_gimnasio_id": string,"p_texto": string }; Returns: Json
                           },
"volver_a_dar_de_alta":
{ Args: { "p_socio_id": string }; Returns: undefined
                           },
"wods_socio":
{ Args: { "p_socio_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "veredicto_acceso": {
                        "puede": boolean | null,"color": string | null,"via": string | null,"motivo": string | null,"texto": string | null,"vence_en": string | null,"tolerancia_usada": number | null,"tolerancia_total": number | null,"para_regularizar": number | null,"pack_restantes": number | null,"consume": string | null,"consume_id": string | null,"avisos": (string)[] | null,"modo_aviso": boolean | null
                      }
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
