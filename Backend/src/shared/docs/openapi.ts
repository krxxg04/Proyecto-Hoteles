import { ROLES } from '@/shared/dominio/rol';
import { MEDIOS_PAGO } from '@/shared/dominio/pago';
import { TIPOS_DOC } from '@/shared/dominio/documento';
import { ESTADOS_CUARTO } from '@/modules/cuartos/domain/tipos';
import { MODOS_ESTADIA } from '@/modules/estadias/domain/tipos';
import { CATEGORIAS_PRODUCTO, CLASES_PRODUCTO } from '@/modules/inventario/domain/tipos';
import { ACCIONES } from '@/modules/asistente/domain/acciones';
import { TIPOS_MEDIO, MIMES_PERMITIDOS, BYTES_MAXIMOS } from '@/modules/medios/domain/tipos';

/** Especificación OpenAPI de `/api`. Al tocar una ruta, actualizar aquí. */

const ErrorApi = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', enum: [false] },
    error: { type: 'string' },
    campo: { type: 'string' },
  },
  required: ['ok', 'error'],
};

function ok(datos: object) {
  return {
    type: 'object',
    properties: { ok: { type: 'boolean', enum: [true] }, datos },
    required: ['ok', 'datos'],
  };
}

const ERRORES = {
  '400': {
    description: 'Validación o regla de negocio.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorApi' } } },
  },
  '401': {
    description: 'Sin sesión.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorApi' } } },
  },
  '403': {
    description: 'Rol insuficiente.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorApi' } } },
  },
};

function respuesta(descripcion: string, datos: object) {
  return {
    '200': { description: descripcion, content: { 'application/json': { schema: ok(datos) } } },
    ...ERRORES,
  };
}

function cuerpoJson(schema: object) {
  return { required: true, content: { 'application/json': { schema } } };
}

const Uuid = { type: 'string', format: 'uuid' };
const Dinero = { type: 'number', description: 'Soles (S/). Lo calcula el servidor.' };

export const documentoOpenAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Hostal Inteligente · API',
    version: '0.1.0',
    description:
      'Entra con `POST /api/auth` (la cookie queda puesta) y abre turno con `POST /api/turno`: sin turno abierto no se puede vender ni hacer check-in.',
  },
  servers: [{ url: '/', description: 'Este mismo servidor' }],
  tags: [
    { name: 'Sesión' },
    { name: 'Turno y caja' },
    { name: 'Cuartos' },
    { name: 'Inventario' },
    { name: 'Huéspedes' },
    { name: 'Ventas' },
    { name: 'Estadías' },
    { name: 'Asistente' },
    { name: 'Incidencias' },
    { name: 'Personal' },
    { name: 'Reservas' },
    { name: 'Medios' },
    { name: 'Reportes' },
    { name: 'Servicio' },
  ],

  paths: {
    '/api/salud': {
      get: {
        tags: ['Servicio'],
        summary: 'Ping público',
        security: [],
        responses: {
          '200': {
            description: 'El servicio responde.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    servicio: { type: 'string' },
                    supabase: { type: 'boolean' },
                  },
                },
                example: { ok: true, servicio: 'hostal-backend', supabase: true },
              },
            },
          },
        },
      },
    },

    '/api/auth': {
      post: {
        tags: ['Sesión'],
        summary: 'Iniciar sesión con DNI y PIN',
        description: 'Empieza por aquí: deja la cookie de sesión puesta para el resto de llamadas.',
        security: [],
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            dni: { type: 'string', minLength: 6, maxLength: 20, pattern: '^[0-9A-Za-z-]+$' },
            pin: { type: 'string', minLength: 4, maxLength: 64 },
          },
          required: ['dni', 'pin'],
          example: { dni: '40123456', pin: '123456' },
        }),
        responses: respuesta('Sesión iniciada.', { $ref: '#/components/schemas/Sesion' }),
      },
      get: {
        tags: ['Sesión'],
        summary: 'Quién está conectado',
        responses: {
          '200': {
            description: 'La sesión actual, o `null`.',
            content: {
              'application/json': {
                schema: ok({
                  oneOf: [{ $ref: '#/components/schemas/Sesion' }, { type: 'null' }],
                }),
              },
            },
          },
        },
      },
      delete: {
        tags: ['Sesión'],
        summary: 'Cerrar sesión',
        responses: respuesta('Sesión cerrada.', { type: 'null' }),
      },
    },

    '/api/asistente': {
      post: {
        tags: ['Asistente'],
        summary: 'Interpretar un comando en lenguaje natural',
        description: [
          'Reglas primero, Claude Haiku solo para lo que no reconocen. No ejecuta nada.',
          '',
          'Si falta información devuelve `tipo: "pregunta"`: manda el `contexto` tal cual en la',
          'siguiente llamada junto con la respuesta del usuario, y así hasta que salga la tarjeta.',
          'Un check-in completo suele tomar 3 o 4 turnos.',
        ].join('\n'),
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            texto: { type: 'string' },
            contexto: {
              ...{ $ref: '#/components/schemas/ContextoConversacion' },
              description: 'Solo al continuar una conversación. Es el que devolvió la pregunta anterior.',
            },
          },
          required: ['texto'],
          example: { texto: 'Llegó una pareja, doble, 2 noches, efectivo' },
        }),
        responses: respuesta('Tarjeta, pregunta de aclaración, o que no entendió.', {
          oneOf: [
            {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['tarjeta'] },
                tarjeta: { $ref: '#/components/schemas/TarjetaAccion' },
              },
            },
            {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['pregunta'] },
                pregunta: { type: 'string', example: '¿Qué habitación?' },
                contexto: { $ref: '#/components/schemas/ContextoConversacion' },
                avance: {
                  type: 'object',
                  properties: {
                    completos: { type: 'array', items: { type: 'string' } },
                    faltantes: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
            {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['sin_entender'] },
                mensaje: { type: 'string' },
                sugerencias: { type: 'array', items: { type: 'string' } },
              },
            },
          ],
        }),
      },
      put: {
        tags: ['Asistente'],
        summary: 'Ejecutar una tarjeta confirmada',
        description:
          'La tarjeta pasó por el cliente, así que aquí se revalida entera y los ids se resuelven de nuevo.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { tarjeta: { $ref: '#/components/schemas/TarjetaAccion' } },
          required: ['tarjeta'],
        }),
        responses: respuesta('Lo que devuelva la acción ejecutada.', { type: 'object' }),
      },
    },

    '/api/incidencias': {
      get: {
        tags: ['Incidencias'],
        summary: 'Descuadres del cierre de turno',
        parameters: [
          {
            name: 'todas',
            in: 'query',
            description: 'Cualquier valor no vacío incluye las ya revisadas.',
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: respuesta('Incidencias.', {
          type: 'array',
          items: { $ref: '#/components/schemas/Incidencia' },
        }),
      },
      patch: {
        tags: ['Incidencias'],
        summary: 'Marcar una incidencia como revisada',
        description: 'Revisada = una persona la miró y decidió. Nunca se acusa a nadie automáticamente.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { incidencia_id: Uuid },
          required: ['incidencia_id'],
        }),
        responses: respuesta('Marcada.', { type: 'null' }),
      },
    },

    '/api/inventario': {
      get: {
        tags: ['Inventario'],
        summary: 'Kardex de movimientos',
        parameters: [{ name: 'producto', in: 'query', schema: Uuid }],
        responses: respuesta('Últimos movimientos, con quién y por qué.', {
          type: 'array',
          items: { type: 'object' },
        }),
      },
      post: {
        tags: ['Inventario'],
        summary: 'Mover stock: compra, entrega o ajuste',
        description:
          'Pasa por funciones SQL: el permiso de escritura sobre `movimientos_inventario` está revocado.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['compra', 'entrega', 'ajuste'] },
            producto_id: Uuid,
            cantidad: { type: 'number', exclusiveMinimum: 0 },
            cuarto_id: { ...Uuid, description: 'Obligatorio si `tipo` es `entrega`.' },
            motivo: { type: 'string', description: 'Obligatorio si `tipo` es `ajuste`.' },
          },
          required: ['tipo', 'producto_id', 'cantidad'],
          example: {
            tipo: 'compra',
            producto_id: '00000000-0000-0000-0000-000000000000',
            cantidad: 24,
          },
        }),
        responses: respuesta('Stock movido.', { type: 'null' }),
      },
    },

    '/api/personal': {
      get: {
        tags: ['Personal'],
        summary: 'El equipo del hostal',
        description: 'Solo administrador.',
        responses: respuesta('Personal del hostal.', { type: 'array', items: { type: 'object' } }),
      },
      post: {
        tags: ['Personal'],
        summary: 'Dar de alta a una persona',
        description: 'El PIN vive cifrado en Supabase Auth; nunca se guarda en la tabla.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            dni: { type: 'string', minLength: 6, maxLength: 20 },
            nombre: { type: 'string', minLength: 2, maxLength: 160 },
            rol: { type: 'string', enum: [...ROLES] },
            telefono: { type: 'string', maxLength: 30 },
            pin: { type: 'string', minLength: 4, pattern: '^[0-9]+$' },
          },
          required: ['dni', 'nombre', 'rol', 'pin'],
          example: { dni: '45678901', nombre: 'Rosa Quispe', rol: 'recepcion', pin: '246810' },
        }),
        responses: respuesta('Persona creada.', {
          type: 'object',
          properties: { id: Uuid, dni: { type: 'string' } },
        }),
      },
      delete: {
        tags: ['Personal'],
        summary: 'Baja lógica de una persona',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { persona_id: Uuid },
          required: ['persona_id'],
        }),
        responses: respuesta('Dada de baja.', { type: 'null' }),
      },
    },

    '/api/panel': {
      get: {
        tags: ['Reportes'],
        summary: 'Resumen del panel de inicio',
        responses: respuesta('Resumen del día.', { $ref: '#/components/schemas/ResumenPanel' }),
      },
    },

    '/api/aseo': {
      get: {
        tags: ['Inventario'],
        summary: 'Qué hay en lavandería',
        description:
          'Los no descartables (toallas, sábanas) salen del stock al mandarlos a lavar y vuelven al confirmarlos.',
        responses: respuesta('Pendientes de lavandería.', {
          type: 'array',
          items: { $ref: '#/components/schemas/PendienteAseo' },
        }),
      },
      post: {
        tags: ['Inventario'],
        summary: 'Mandar a lavar',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            producto_id: Uuid,
            cantidad: { type: 'number', exclusiveMinimum: 0, default: 1 },
            cuarto_id: { ...Uuid, description: 'De qué habitación salió.' },
          },
          required: ['producto_id'],
          example: { producto_id: '00000000-0000-0000-0000-000000000000', cantidad: 2 },
        }),
        responses: respuesta('Enviado.', { type: 'null' }),
      },
      patch: {
        tags: ['Inventario'],
        summary: 'Volvió de lavandería',
        description: 'Reingresa al stock disponible.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { aseo_id: Uuid },
          required: ['aseo_id'],
        }),
        responses: respuesta('Reingresado.', { type: 'null' }),
      },
    },

    '/api/reservas': {
      get: {
        tags: ['Reservas'],
        summary: 'Reservas próximas',
        description:
          'Desde ayer en adelante: una reserva de anoche sin resolver sigue necesitando una decisión.',
        parameters: [
          {
            name: 'todas',
            in: 'query',
            description: 'Cualquier valor no vacío incluye canceladas, no-shows y ya convertidas.',
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: respuesta('Reservas.', {
          type: 'array',
          items: { $ref: '#/components/schemas/Reserva' },
        }),
      },
      post: {
        tags: ['Reservas'],
        summary: 'Crear o editar una reserva',
        description: [
          'Una reserva NO bloquea la habitación: hasta el check-in el cuarto se puede vender.',
          'Por eso se reserva un tipo de cuarto y el número concreto se asigna al llegar.',
          '',
          'Con `id` en el cuerpo, edita en vez de crear.',
        ].join(String.fromCharCode(10)),
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            id: { ...Uuid, description: 'Solo para editar.' },
            nombre_contacto: { type: 'string', minLength: 2, maxLength: 160 },
            telefono: { type: 'string', maxLength: 30 },
            huesped_id: Uuid,
            tipo_id: { ...Uuid, description: 'Tipo de habitación pedido.' },
            cuarto_id: { ...Uuid, description: 'Solo si ya se asignó una concreta.' },
            fecha_entrada: { type: 'string', format: 'date' },
            fecha_salida: { type: 'string', format: 'date' },
            personas: { type: 'integer', minimum: 1, maximum: 12, default: 1 },
            origen: { type: 'string', maxLength: 40, default: 'directo' },
            notas: { type: 'string', maxLength: 500 },
          },
          required: ['nombre_contacto', 'fecha_entrada'],
          example: {
            nombre_contacto: 'Julia Paredes',
            telefono: '987654321',
            fecha_entrada: '2026-08-30',
            personas: 2,
          },
        }),
        responses: respuesta('Reserva guardada.', { $ref: '#/components/schemas/Reserva' }),
      },
      patch: {
        tags: ['Reservas'],
        summary: 'Confirmar, cancelar o marcar que no se presentó',
        description:
          '`convertida` no se acepta: esa la pone el check-in. Marcarla a mano sería decir «ya entró» sin que nadie haya entrado ni pagado.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            reserva_id: Uuid,
            estado: { type: 'string', enum: ['pendiente', 'confirmada', 'cancelada', 'no_show'] },
          },
          required: ['reserva_id', 'estado'],
        }),
        responses: respuesta('Actualizada.', { type: 'null' }),
      },
    },

    '/api/medios': {
      get: {
        tags: ['Medios'],
        summary: 'URL firmada de una foto, o las fotos de un huésped o estadía',
        description:
          'El bucket de R2 es PRIVADO. Esto devuelve una URL firmada que caduca en minutos: no sirve para compartir por fuera ni para guardar en ningún sitio.',
        parameters: [
          { name: 'id', in: 'query', description: 'Devuelve la URL firmada de ese medio.', schema: Uuid },
          { name: 'huesped_id', in: 'query', schema: Uuid },
          { name: 'estadia_id', in: 'query', schema: Uuid },
        ],
        responses: respuesta('URL firmada, o la lista de medios.', {
          oneOf: [
            {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'uri' },
                expira_en_segundos: { type: 'integer', example: 300 },
                tipo: { type: 'string', enum: [...TIPOS_MEDIO] },
              },
            },
            { type: 'array', items: { $ref: '#/components/schemas/Medio' } },
          ],
        }),
      },
      post: {
        tags: ['Medios'],
        summary: 'Pedir permiso para subir una foto',
        description: [
          'El archivo NO pasa por el backend: se devuelve una URL firmada y el navegador hace el PUT',
          'directo a R2 con las cabeceras indicadas. El tipo y el tamaño van firmados, así que la URL',
          'no sirve para subir otra cosa.',
          '',
          'Para `dni` y `rostro` hace falta consentimiento del huésped (Ley 29733): si no hay uno',
          'vigente, manda `consentimiento` con la evidencia de cómo se dio.',
        ].join('\n'),
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: [...TIPOS_MEDIO] },
            mime: { type: 'string', enum: [...MIMES_PERMITIDOS] },
            bytes: { type: 'integer', maximum: BYTES_MAXIMOS },
            huesped_id: { ...Uuid, description: 'Obligatorio para `dni` y `rostro`.' },
            estadia_id: Uuid,
            consentimiento: { type: 'string', maxLength: 300 },
          },
          required: ['tipo', 'mime', 'bytes'],
          example: { tipo: 'inspeccion', mime: 'image/webp', bytes: 148230 },
        }),
        responses: respuesta('Permiso de subida.', {
          type: 'object',
          properties: {
            medio_id: Uuid,
            url: { type: 'string', format: 'uri' },
            metodo: { type: 'string', enum: ['PUT'] },
            cabeceras: { type: 'object', additionalProperties: { type: 'string' } },
            expira_en_segundos: { type: 'integer', example: 120 },
          },
        }),
      },
      delete: {
        tags: ['Medios'],
        summary: 'Borrar una foto',
        description: 'Borra el objeto en R2 y después la fila. Derecho de supresión de la Ley 29733.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { id: Uuid },
          required: ['id'],
        }),
        responses: respuesta('Borrada.', { type: 'null' }),
      },
    },

    '/api/catalogos': {
      get: {
        tags: ['Servicio'],
        summary: 'Catálogos globales para los formularios',
        description:
          'Características de cuarto y bancos. Van juntos porque son dos listas cortas que no cambian.',
        responses: respuesta('Catálogos.', {
          type: 'object',
          properties: {
            caracteristicas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  clave: { type: 'string' },
                  label: { type: 'string' },
                  icono: { type: 'string' },
                },
              },
            },
            bancos: {
              type: 'array',
              items: {
                type: 'object',
                properties: { clave: { type: 'string' }, label: { type: 'string' } },
              },
            },
          },
        }),
      },
    },

    '/api/tarifa': {
      get: {
        tags: ['Cuartos'],
        summary: 'Cotizar una estadía',
        description:
          'Solo cotiza. El precio del check-in lo vuelve a calcular la base al ejecutarlo: este número es para mostrar, nunca para cobrar.',
        parameters: [
          { name: 'cuarto_id', in: 'query', required: true, schema: Uuid },
          { name: 'modo', in: 'query', required: true, schema: { type: 'string', enum: [...MODOS_ESTADIA] } },
          { name: 'horas', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 24 } },
          { name: 'noches', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 60 } },
          { name: 'fecha_entrada', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: respuesta('Desglose del precio.', { $ref: '#/components/schemas/DetalleTarifa' }),
      },
    },

    '/api/cuartos': {
      get: {
        tags: ['Cuartos'],
        summary: 'Listar habitaciones (o contarlas, o pedir una sugerencia)',
        parameters: [
          {
            name: 'estado',
            in: 'query',
            description: 'Se ignora si mandas `conteo`.',
            schema: { type: 'string', enum: [...ESTADOS_CUARTO] },
          },
          {
            name: 'conteo',
            in: 'query',
            description: 'Cualquier valor no vacío devuelve el conteo por estado.',
            schema: { type: 'string' },
            example: '1',
          },
          {
            name: 'tipos',
            in: 'query',
            description: 'Cualquier valor no vacío devuelve el tarifario en vez de los cuartos.',
            schema: { type: 'string' },
            example: '1',
          },
          {
            name: 'sugerir',
            in: 'query',
            description: 'Cuartos libres que aguantan `personas`, ordenados por lo bien que encajan.',
            schema: { type: 'string' },
            example: '1',
          },
          { name: 'personas', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          {
            name: 'caracteristicas',
            in: 'query',
            description: 'Claves separadas por coma, para afinar la sugerencia.',
            schema: { type: 'string' },
            example: 'tv,jacuzzi',
          },
        ],
        responses: respuesta('Lista de cuartos, el conteo por estado, el tarifario o la sugerencia.', {
          oneOf: [
            { type: 'array', items: { $ref: '#/components/schemas/Cuarto' } },
            {
              type: 'object',
              additionalProperties: { type: 'integer' },
              example: {
                total: 12,
                libre: 2,
                ocupada: 5,
                checkout: 1,
                limpieza: 2,
                inspeccion: 0,
                lista: 2,
                mantenimiento: 0,
              },
            },
          ],
        }),
      },
      patch: {
        tags: ['Cuartos'],
        summary: 'Cambiar el estado de una habitación',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            cuarto_id: Uuid,
            estado: { type: 'string', enum: [...ESTADOS_CUARTO] },
            nota: { type: 'string', maxLength: 300 },
          },
          required: ['cuarto_id', 'estado'],
          example: { cuarto_id: '00000000-0000-0000-0000-000000000000', estado: 'limpieza' },
        }),
        responses: respuesta('Estado cambiado.', { type: 'null' }),
      },
      put: {
        tags: ['Cuartos'],
        summary: 'Guardar un tipo de cuarto (el tarifario)',
        description: 'Solo administrador. Con `id` edita; sin `id` crea. Es lo que cobra el próximo check-in.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            id: { ...Uuid, description: 'Ausente para crear.' },
            nombre: { type: 'string', minLength: 2, maxLength: 80 },
            aforo: { type: 'integer', minimum: 1, maximum: 12 },
            costo: { ...Dinero, minimum: 0 },
            horas_lj: { type: 'integer', minimum: 1, maximum: 24 },
            horas_vd: { type: 'integer', minimum: 1, maximum: 24 },
            hora_extra: { ...Dinero, minimum: 0 },
            amanecida: { ...Dinero, minimum: 0 },
            amanecida_vd: { ...Dinero, minimum: 0 },
            deposito: { ...Dinero, minimum: 0 },
          },
          required: ['nombre', 'aforo', 'costo', 'horas_lj', 'horas_vd'],
          example: { nombre: 'Matrimonial', aforo: 2, costo: 50, horas_lj: 6, horas_vd: 4, amanecida: 120 },
        }),
        responses: respuesta('Tipo guardado.', { type: 'object' }),
      },
      post: {
        tags: ['Cuartos'],
        summary: 'Dar de alta o editar una habitación',
        description:
          'Solo administrador. Con `id` edita; sin `id` crea. El estado no viaja aquí: lo mueve `PATCH`, que lo audita. Un cuarto nuevo nace en `libre`.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            id: { ...Uuid, description: 'Ausente para crear.' },
            numero: { type: 'string', minLength: 1, maxLength: 10 },
            tipo_id: Uuid,
            aforo: { type: 'integer', minimum: 1, maximum: 12 },
            caracteristicas: { type: 'array', items: { type: 'string' } },
            nota: { type: 'string', maxLength: 300 },
            tarifa_costo: {
              ...Dinero,
              nullable: true,
              description: 'Tarifa propia del cuarto. Null usa la del tipo.',
            },
            tarifa_amanecida: { ...Dinero, nullable: true, description: 'Null usa la del tipo.' },
          },
          required: ['numero', 'tipo_id', 'aforo'],
          example: { numero: '302', tipo_id: '00000000-0000-0000-0000-000000000000', aforo: 2, caracteristicas: ['tv', 'wifi'] },
        }),
        responses: respuesta('Cuarto guardado.', { $ref: '#/components/schemas/Cuarto' }),
      },
      delete: {
        tags: ['Cuartos'],
        summary: 'Inhabilitar o volver a habilitar un cuarto o un tipo de cuarto',
        description: [
          'Nada se borra: hay estadías, ventas y auditoría apuntando detrás. Solo administrador.',
          '',
          '| Cuerpo | Qué hace |',
          '|---|---|',
          '| `{ id }` | inhabilita el cuarto; se niega si tiene una estadía activa |',
          '| `{ id, activo: true }` | lo devuelve al servicio como `libre`; se niega si su tipo está inhabilitado |',
          '| `{ tipo_id }` | inhabilita el tipo; se niega si todavía lo usan cuartos activos |',
          '| `{ tipo_id, activo: true }` | lo devuelve al tarifario |',
        ].join('\n'),
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            id: { ...Uuid, description: 'El cuarto. Excluyente con `tipo_id`.' },
            tipo_id: { ...Uuid, description: 'El tipo de cuarto. Excluyente con `id`.' },
            activo: { type: 'boolean', default: false, description: '`true` vuelve a habilitar.' },
          },
        }),
        responses: respuesta('Hecho.', { type: 'null' }),
      },
    },

    '/api/productos': {
      get: {
        tags: ['Inventario'],
        summary: 'Listar productos con su cobertura de stock',
        parameters: [
          {
            name: 'vendibles',
            in: 'query',
            description: 'Cualquier valor no vacío deja solo lo que se cobra.',
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: respuesta('Catálogo activo.', {
          type: 'array',
          items: { $ref: '#/components/schemas/Producto' },
        }),
      },
      post: {
        tags: ['Inventario'],
        summary: 'Dar de alta o editar un producto',
        description:
          'Solo administrador. Con `id` edita; sin `id` crea. El stock nunca viaja aquí: nace en 0 y solo se mueve con movimientos registrados.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            id: { ...Uuid, description: 'Ausente para crear.' },
            nombre: { type: 'string', minLength: 2, maxLength: 120 },
            icono: { type: 'string', maxLength: 40, default: 'package' },
            unidad: { type: 'string', maxLength: 20, description: 'unid., rollos, juegos...' },
            stock_max: { type: 'number', exclusiveMinimum: 0 },
            stock_min: {
              type: 'number',
              minimum: 0,
              default: 0,
              description: 'Avisar cuando el stock baje de aquí. 0 = sin aviso. Menor que `stock_max`.',
            },
            categoria: { type: 'string', enum: [...CATEGORIAS_PRODUCTO] },
            clase: { type: 'string', enum: [...CLASES_PRODUCTO] },
            precio: { ...Dinero, minimum: 0, description: 'Obligatorio (> 0) si es `vendible`.' },
          },
          required: ['nombre', 'unidad', 'stock_max', 'categoria', 'clase', 'precio'],
          example: {
            nombre: 'Agua sin gas 625 ml',
            icono: 'cup-soda',
            unidad: 'unid.',
            stock_max: 48,
            stock_min: 12,
            categoria: 'vendible',
            clase: 'descartable',
            precio: 3,
          },
        }),
        responses: respuesta('Producto guardado.', { $ref: '#/components/schemas/Producto' }),
      },
      delete: {
        tags: ['Inventario'],
        summary: 'Dar de baja un producto',
        description: 'Baja lógica: el kardex y las ventas siguen apuntando al producto.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { id: Uuid },
          required: ['id'],
        }),
        responses: respuesta('Producto dado de baja.', { type: 'null' }),
      },
    },

    '/api/huespedes': {
      get: {
        tags: ['Huéspedes'],
        summary: 'Listar o buscar huéspedes',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Busca por nombre o documento.',
            schema: { type: 'string' },
            example: 'Julia',
          },
        ],
        responses: respuesta('Hasta 200 huéspedes.', {
          type: 'array',
          items: { $ref: '#/components/schemas/Huesped' },
        }),
      },
      post: {
        tags: ['Huéspedes'],
        summary: 'Registrar un huésped',
        description: 'No suele hacer falta: el check-in ya crea o reutiliza el huésped por su documento.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            nombre: { type: 'string', minLength: 2, maxLength: 160 },
            tipo_doc: { type: 'string', enum: [...TIPOS_DOC], default: 'DNI' },
            num_doc: { type: 'string', minLength: 6, maxLength: 20, pattern: '^[0-9A-Za-z-]+$' },
            telefono: { type: 'string', maxLength: 30 },
            email: { type: 'string', format: 'email' },
            nacionalidad: { type: 'string', maxLength: 60 },
            notas: { type: 'string', maxLength: 1000 },
          },
          required: ['nombre', 'num_doc'],
          example: {
            nombre: 'Julia Paredes',
            tipo_doc: 'DNI',
            num_doc: '76543210',
            telefono: '999888777',
          },
        }),
        responses: respuesta('Huésped registrado.', { $ref: '#/components/schemas/Huesped' }),
      },
    },

    '/api/ventas': {
      get: {
        tags: ['Ventas'],
        summary: 'Ventas del turno o del día',
        parameters: [
          {
            name: 'resumen',
            in: 'query',
            description: 'Cualquier valor no vacío devuelve los totales del turno.',
            schema: { type: 'string' },
            example: '1',
          },
          { name: 'turno', in: 'query', description: 'UUID de un turno concreto.', schema: Uuid },
        ],
        responses: respuesta('Ventas o resumen.', {
          oneOf: [
            { type: 'array', items: { $ref: '#/components/schemas/Venta' } },
            { $ref: '#/components/schemas/ResumenVentas' },
          ],
        }),
      },
      post: {
        tags: ['Ventas'],
        summary: 'Vender un producto',
        description: 'El monto no viaja: sale del catálogo. Requiere turno abierto y rol de caja.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            producto_id: Uuid,
            cantidad: { type: 'number', exclusiveMinimum: 0 },
            cuarto_id: { ...Uuid, description: 'Opcional: a qué habitación se carga.' },
            medio: { type: 'string', enum: [...MEDIOS_PAGO] },
            banco: { type: 'string', maxLength: 40, description: 'Obligatorio si `medio` es `tarjeta`.' },
          },
          required: ['producto_id', 'cantidad', 'medio'],
          example: {
            producto_id: '00000000-0000-0000-0000-000000000000',
            cantidad: 2,
            medio: 'efectivo',
          },
        }),
        responses: respuesta('Venta registrada.', {
          type: 'object',
          properties: { venta_id: Uuid },
        }),
      },
    },

    '/api/checkin': {
      get: {
        tags: ['Estadías'],
        summary: 'Estadías en curso',
        responses: respuesta('Estadías activas.', {
          type: 'array',
          items: { $ref: '#/components/schemas/EstadiaActiva' },
        }),
      },
      post: {
        tags: ['Estadías'],
        summary: 'Check-in completo',
        description: 'Todo en una transacción. `horas` exige `horas`, `rango` exige `noches`, `dia` es una noche.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            cuarto_id: Uuid,
            modo: { type: 'string', enum: [...MODOS_ESTADIA] },
            horas: { type: 'integer', minimum: 1, maximum: 24 },
            noches: { type: 'integer', minimum: 1, maximum: 60 },
            fecha_entrada: { type: 'string', format: 'date', description: 'Por defecto, hoy.' },
            personas: { type: 'integer', minimum: 1, maximum: 12, default: 1 },
            nombre: { type: 'string', minLength: 2, maxLength: 160 },
            tipo_doc: { type: 'string', enum: [...TIPOS_DOC], default: 'DNI' },
            num_doc: { type: 'string', minLength: 6, maxLength: 20 },
            telefono: { type: 'string', maxLength: 30 },
            medio: { type: 'string', enum: [...MEDIOS_PAGO] },
            banco: { type: 'string', maxLength: 40, description: 'Obligatorio si `medio` es `tarjeta`.' },
            acompanantes: {
              type: 'array',
              description: 'Como mucho `personas - 1`.',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string', minLength: 2 },
                  tipo_doc: { type: 'string', maxLength: 30 },
                  num_doc: { type: 'string', maxLength: 20 },
                },
                required: ['nombre'],
              },
            },
          },
          required: ['cuarto_id', 'modo', 'nombre', 'num_doc', 'medio'],
          example: {
            cuarto_id: '00000000-0000-0000-0000-000000000000',
            modo: 'rango',
            noches: 2,
            personas: 2,
            nombre: 'Julia Paredes',
            num_doc: '76543210',
            medio: 'efectivo',
            acompanantes: [{ nombre: 'Marco Paredes', tipo_doc: 'DNI', num_doc: '76543211' }],
          },
        }),
        responses: respuesta('Check-in hecho.', {
          type: 'object',
          properties: {
            estadia_id: Uuid,
            huesped_id: Uuid,
            cuarto: { type: 'string' },
            tarifa: { $ref: '#/components/schemas/DetalleTarifa' },
          },
        }),
      },
      delete: {
        tags: ['Estadías'],
        summary: 'Check-out',
        description: 'Deja el cuarto en `checkout`, no en disponible: antes van inspección y limpieza.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: { estadia_id: Uuid },
          required: ['estadia_id'],
        }),
        responses: respuesta('Check-out hecho.', { type: 'null' }),
      },
    },

    '/api/inspecciones': {
      get: {
        tags: ['Estadías'],
        summary: 'Checklist de inspección, o el historial',
        description:
          'Con `plantilla=1` devuelve qué revisar en ese cuarto y contra qué estadía. Sin él, las últimas inspecciones.',
        parameters: [
          { name: 'cuarto_id', in: 'query', schema: Uuid },
          {
            name: 'plantilla',
            in: 'query',
            description: 'Cualquier valor no vacío pide el checklist en blanco. Exige `cuarto_id`.',
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: respuesta('Checklist o historial.', {
          oneOf: [
            { $ref: '#/components/schemas/PlantillaInspeccion' },
            { type: 'array', items: { $ref: '#/components/schemas/Inspeccion' } },
          ],
        }),
      },
      post: {
        tags: ['Estadías'],
        summary: 'Guardar una inspección',
        description:
          'No descuenta inventario: un faltante se registra aparte y con motivo. Con `pasar_a_limpieza` el cuarto sigue el flujo.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            cuarto_id: Uuid,
            estadia_id: { ...Uuid, nullable: true },
            resultado: { type: 'array', items: { $ref: '#/components/schemas/ItemInspeccion' } },
            nota: { type: 'string', maxLength: 1000 },
            pasar_a_limpieza: { type: 'boolean', default: false },
          },
          required: ['cuarto_id', 'resultado'],
          example: {
            cuarto_id: '00000000-0000-0000-0000-000000000000',
            resultado: [
              { item: 'Toallas', esperado: 2, confirmado: 1, nota: 'Falta una' },
              { item: 'Televisor', esperado: 1, confirmado: 1 },
            ],
            pasar_a_limpieza: true,
          },
        }),
        responses: respuesta('Inspección guardada.', {
          type: 'object',
          properties: {
            id: Uuid,
            faltantes: { type: 'integer', description: 'Cuántos ítems salieron por debajo de lo esperado.' },
          },
        }),
      },
    },

    '/api/turno': {
      get: {
        tags: ['Turno y caja'],
        summary: 'Estado de caja (o el conteo esperado de cierre)',
        parameters: [
          {
            name: 'conteo',
            in: 'query',
            description: 'Cualquier valor no vacío pide el conteo esperado.',
            schema: { type: 'string' },
            example: '1',
          },
        ],
        responses: respuesta('Estado de caja, o las líneas del conteo.', {
          oneOf: [
            { $ref: '#/components/schemas/EstadoCaja' },
            { type: 'array', items: { $ref: '#/components/schemas/LineaConteo' } },
          ],
        }),
      },
      post: {
        tags: ['Turno y caja'],
        summary: 'Abrir turno',
        description: 'Solo puede haber uno abierto por hostal.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            efectivo_contado: { ...Dinero, minimum: 0, description: 'Lo que hay en caja al empezar.' },
            justificacion: { type: 'string', maxLength: 500 },
          },
          required: ['efectivo_contado'],
          example: { efectivo_contado: 0 },
        }),
        responses: respuesta('Turno abierto.', { type: 'object', properties: { turno_id: Uuid } }),
      },
      put: {
        tags: ['Turno y caja'],
        summary: 'Cerrar turno y caja',
        description: 'Un descuadre sin justificar aborta todo el cierre. Pide antes `GET /api/turno?conteo=1`.',
        requestBody: cuerpoJson({
          type: 'object',
          properties: {
            conteos: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  producto_id: Uuid,
                  contado: { type: 'number', minimum: 0 },
                  justificacion: {
                    type: 'string',
                    maxLength: 500,
                    description: 'Obligatoria si no cuadra.',
                  },
                },
                required: ['producto_id', 'contado'],
              },
            },
            sencillo_dejar: { ...Dinero, minimum: 0, description: 'Efectivo que se deja al siguiente turno.' },
            ajuste_monto: { ...Dinero, exclusiveMinimum: 0 },
            ajuste_razon: {
              type: 'string',
              maxLength: 500,
              description: 'Obligatoria si mandas `ajuste_monto`.',
            },
          },
          required: ['conteos', 'sencillo_dejar'],
          example: {
            conteos: [{ producto_id: '00000000-0000-0000-0000-000000000000', contado: 38 }],
            sencillo_dejar: 0,
          },
        }),
        responses: respuesta('Turno cerrado.', { $ref: '#/components/schemas/ResumenCierre' }),
      },
    },
  },

  components: {
    schemas: {
      ErrorApi,

      ContextoConversacion: {
        type: 'object',
        description:
          'Conversación a medias. Vive en el cliente para que el backend siga sin estado; no es autoritativo — al ejecutar se revalida todo.',
        properties: {
          accion: { type: 'string', enum: [...ACCIONES] },
          parametros: { type: 'object', additionalProperties: true },
          esperando: { type: 'string', description: 'El campo que se acaba de preguntar.' },
        },
        required: ['accion', 'parametros'],
      },

      TarjetaAccion: {
        type: 'object',
        description: 'Lo que el asistente propone. Nunca lleva monto: el precio lo pone la base al ejecutar.',
        properties: {
          accion: { type: 'string', enum: [...ACCIONES] },
          titulo: { type: 'string' },
          resumen: { type: 'string', description: 'Una línea para que la persona lea y confirme.' },
          parametros: { type: 'object', additionalProperties: true },
          referencias: { type: 'object', properties: { cuarto_id: Uuid, producto_id: Uuid } },
          origen: { type: 'string', enum: ['reglas', 'ia'] },
          confianza: { type: 'number', minimum: 0, maximum: 1 },
          requiere_confirmacion: { type: 'boolean', description: 'true si escribe en la base.' },
          listo: { type: 'boolean' },
          faltantes: { type: 'array', items: { type: 'string' } },
        },
      },

      Incidencia: {
        type: 'object',
        properties: {
          id: Uuid,
          turno_id: { type: ['string', 'null'], format: 'uuid' },
          producto_id: { type: ['string', 'null'], format: 'uuid' },
          concepto: { type: 'string' },
          unidad: { type: 'string' },
          esperado: { type: 'number' },
          contado: { type: 'number' },
          diferencia: { type: 'number', description: '> 0 faltante · < 0 sobrante.' },
          justificacion: { type: 'string' },
          estado: { type: 'string', enum: ['abierta', 'revisada'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      Sesion: {
        type: 'object',
        properties: {
          usuarioId: Uuid,
          tenantId: Uuid,
          rol: { type: 'string', enum: [...ROLES] },
          nombre: { type: 'string' },
          dni: { type: 'string' },
        },
      },

      Cuarto: {
        type: 'object',
        properties: {
          id: Uuid,
          numero: { type: 'string' },
          tipo_id: Uuid,
          tipo: { type: 'string' },
          estado: { type: 'string', enum: [...ESTADOS_CUARTO] },
          nota: { type: ['string', 'null'] },
          aforo: { type: 'integer' },
          caracteristicas: { type: 'array', items: { type: 'string' }, example: ['tv', 'wifi'] },
          tarifa_costo: { type: ['number', 'null'], description: 'Si es `null`, manda la del tipo.' },
          tarifa_amanecida: { type: ['number', 'null'] },
          activo: { type: 'boolean' },
        },
      },

      Producto: {
        type: 'object',
        properties: {
          id: Uuid,
          nombre: { type: 'string' },
          icono: { type: 'string' },
          unidad: { type: 'string' },
          stock: { type: 'number' },
          stock_max: { type: 'number' },
          categoria: { type: 'string', enum: [...CATEGORIAS_PRODUCTO] },
          clase: { type: 'string', enum: [...CLASES_PRODUCTO] },
          precio: Dinero,
          activo: { type: 'boolean' },
          nivel: { type: 'integer', description: '% de llenado respecto al máximo.' },
          dias: { type: ['integer', 'null'], description: 'Días de cobertura estimados.' },
          semaforo: { type: 'string', enum: ['danger', 'warning', 'success'] },
        },
      },

      Huesped: {
        type: 'object',
        properties: {
          id: Uuid,
          nombre: { type: 'string' },
          tipo_doc: { type: 'string', enum: [...TIPOS_DOC] },
          num_doc: { type: 'string' },
          telefono: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          nacionalidad: { type: ['string', 'null'] },
          notas: { type: ['string', 'null'] },
          requiere_revision: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      EstadiaActiva: {
        type: 'object',
        properties: {
          id: Uuid,
          modo: { type: 'string', enum: [...MODOS_ESTADIA] },
          horas: { type: ['integer', 'null'] },
          noches: { type: ['integer', 'null'] },
          fecha_entrada: { type: 'string', format: 'date' },
          fecha_salida: { type: ['string', 'null'], format: 'date' },
          hora_entrada: { type: 'string' },
          personas: { type: 'integer' },
          tarifa_total: Dinero,
          deposito: Dinero,
          estado: { type: 'string', enum: ['activa', 'cerrada', 'cancelada'] },
          cuartos: { type: 'object', properties: { id: Uuid, numero: { type: 'string' } } },
          huespedes: {
            type: 'object',
            properties: {
              id: Uuid,
              nombre: { type: 'string' },
              tipo_doc: { type: 'string' },
              num_doc: { type: 'string' },
              telefono: { type: ['string', 'null'] },
            },
          },
        },
      },

      PendienteAseo: {
        type: 'object',
        properties: {
          id: Uuid,
          cantidad: { type: 'number' },
          enviado_at: { type: 'string', format: 'date-time' },
          productos: {
            type: 'object',
            properties: { nombre: { type: 'string' }, unidad: { type: 'string' } },
          },
          cuartos: { type: ['object', 'null'], properties: { numero: { type: 'string' } } },
          profiles: { type: ['object', 'null'], properties: { nombre: { type: 'string' } } },
        },
      },

      Reserva: {
        type: 'object',
        properties: {
          id: Uuid,
          huesped_id: { type: ['string', 'null'], format: 'uuid' },
          nombre_contacto: { type: ['string', 'null'] },
          telefono: { type: ['string', 'null'] },
          tipo_id: { type: ['string', 'null'], format: 'uuid' },
          cuarto_id: { type: ['string', 'null'], format: 'uuid' },
          fecha_entrada: { type: 'string', format: 'date' },
          fecha_salida: { type: ['string', 'null'], format: 'date' },
          personas: { type: 'integer' },
          estado: {
            type: 'string',
            enum: ['pendiente', 'confirmada', 'cancelada', 'no_show', 'convertida'],
          },
          origen: { type: ['string', 'null'] },
          notas: { type: ['string', 'null'] },
          estadia_id: { type: ['string', 'null'], format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          tipos_cuarto: { type: ['object', 'null'], properties: { nombre: { type: 'string' } } },
          cuartos: { type: ['object', 'null'], properties: { numero: { type: 'string' } } },
        },
      },

      Medio: {
        type: 'object',
        description: 'Guarda la LLAVE del objeto, jamás una URL pública.',
        properties: {
          id: Uuid,
          bucket: { type: 'string' },
          object_key: { type: 'string' },
          mime: { type: 'string' },
          bytes: { type: 'integer' },
          tipo: { type: 'string', enum: [...TIPOS_MEDIO] },
          huesped_id: { type: ['string', 'null'], format: 'uuid' },
          estadia_id: { type: ['string', 'null'], format: 'uuid' },
          retener_hasta: { type: ['string', 'null'], format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      ItemInspeccion: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          icono: { type: 'string', description: 'Nombre del icono Lucide, para la vista.' },
          esperado: { type: 'integer', minimum: 0 },
          confirmado: { type: 'integer', minimum: 0, description: 'Menos que `esperado` = falta algo.' },
          nota: { type: 'string', maxLength: 300 },
        },
        required: ['item', 'esperado', 'confirmado'],
      },

      PlantillaInspeccion: {
        type: 'object',
        properties: {
          cuarto: {
            type: 'object',
            properties: { id: Uuid, numero: { type: 'string' }, estado: { type: 'string' } },
          },
          estadia_id: { type: ['string', 'null'], format: 'uuid' },
          items: { type: 'array', items: { $ref: '#/components/schemas/ItemInspeccion' } },
        },
      },

      Inspeccion: {
        type: 'object',
        properties: {
          id: Uuid,
          cuarto_id: Uuid,
          estadia_id: { type: ['string', 'null'], format: 'uuid' },
          resultado: { type: 'array', items: { $ref: '#/components/schemas/ItemInspeccion' } },
          nota: { type: ['string', 'null'] },
          created_at: { type: 'string', format: 'date-time' },
          cuartos: { type: 'object', properties: { numero: { type: 'string' } } },
        },
      },

      DetalleTarifa: {
        type: 'object',
        properties: {
          total: Dinero,
          deposito: Dinero,
          moneda: { type: 'string', example: 'PEN' },
          modo: { type: 'string', enum: [...MODOS_ESTADIA] },
          detalle: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                concepto: { type: 'string' },
                monto: Dinero,
                fin_de_semana: { type: 'boolean' },
              },
            },
          },
        },
      },

      Venta: {
        type: 'object',
        properties: {
          id: Uuid,
          turno_id: { type: ['string', 'null'], format: 'uuid' },
          concepto: { type: 'string' },
          producto_id: { type: ['string', 'null'], format: 'uuid' },
          cantidad: { type: ['number', 'null'] },
          cuarto_id: { type: ['string', 'null'], format: 'uuid' },
          monto: Dinero,
          medio: { type: 'string', enum: [...MEDIOS_PAGO] },
          banco: { type: ['string', 'null'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },

      ResumenVentas: {
        type: 'object',
        properties: {
          total: Dinero,
          por_medio: {
            type: 'object',
            additionalProperties: { type: 'number' },
            example: { efectivo: 120, yape: 45 },
          },
          cantidad: { type: 'integer' },
        },
      },

      Turno: {
        type: 'object',
        properties: {
          id: Uuid,
          usuario_id: Uuid,
          estado: { type: 'string', enum: ['abierto', 'cerrado'] },
          abierto_at: { type: 'string', format: 'date-time' },
          cerrado_at: { type: ['string', 'null'], format: 'date-time' },
          sencillo_esperado: Dinero,
          sencillo_apertura: Dinero,
          sencillo_dejado: { type: ['number', 'null'] },
        },
      },

      EstadoCaja: {
        type: 'object',
        properties: {
          turno: { oneOf: [{ $ref: '#/components/schemas/Turno' }, { type: 'null' }] },
          sencillo_esperado: Dinero,
          caja_chica: Dinero,
          usuario: { type: ['string', 'null'], description: 'Quién tiene el turno abierto.' },
          es_de_otro: { type: 'boolean', description: 'El turno lo abrió otra persona.' },
        },
      },

      LineaConteo: {
        type: 'object',
        properties: {
          producto_id: Uuid,
          nombre: { type: 'string' },
          unidad: { type: 'string' },
          apertura: { type: 'number' },
          esperado: { type: 'number' },
        },
      },

      ResumenCierre: {
        type: 'object',
        properties: {
          cierre_id: Uuid,
          recaudado: Dinero,
          por_medio: { type: 'object', additionalProperties: { type: 'number' } },
          por_banco: { type: 'object', additionalProperties: { type: 'number' } },
          efectivo_en_caja: Dinero,
          sencillo_dejado: Dinero,
          a_caja_chica: Dinero,
          incidencias: { type: 'integer' },
        },
      },

      LineaConsumo: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
        },
      },

      ResumenPanel: {
        type: 'object',
        properties: {
          cuartos: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              ocupados: { type: 'integer' },
              disponibles: { type: 'integer', description: 'Listas más libres.' },
              listas: { type: 'integer' },
              porLimpiar: { type: 'integer' },
            },
          },
          ocupacion: { type: 'integer', description: '% de ocupación.' },
          ingresosHoy: Dinero,
          ingresosAyer: Dinero,
          ventasHoy: { type: 'integer' },
          checkinsHoy: { type: 'integer' },
          checkoutsHoy: { type: 'integer' },
          incidenciasAbiertas: { type: 'integer' },
          stockCritico: { type: 'integer', description: 'Productos que tocaron su stock mínimo.' },
          series: {
            type: 'object',
            description:
              'Últimos 14 días, del más viejo al de hoy. Solo hay serie de lo que se puede reconstruir del histórico.',
            properties: {
              checkins: { type: 'array', items: { type: 'integer' } },
              checkouts: { type: 'array', items: { type: 'integer' } },
              ventas: { type: 'array', items: { type: 'integer' } },
            },
          },
          consumo: {
            type: 'object',
            properties: {
              productos: { type: 'array', items: { $ref: '#/components/schemas/LineaConsumo' } },
              tipos: { type: 'array', items: { $ref: '#/components/schemas/LineaConsumo' } },
            },
          },
          porAcabarse: {
            type: ['object', 'null'],
            description: 'El insumo que se agota antes, medido en días de cobertura.',
            properties: { nombre: { type: 'string' }, dias: { type: 'integer' } },
          },
        },
      },
    },

    securitySchemes: {
      cookieSesion: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
        description: 'La pone `POST /api/auth`. No hace falta el botón "Authorize".',
      },
    },
  },

  security: [{ cookieSesion: [] }],
};
