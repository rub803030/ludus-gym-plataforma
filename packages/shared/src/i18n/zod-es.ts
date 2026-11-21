import { z } from 'zod'

const EXPECTED_LABELS: Record<z.ZodParsedType, string> = {
  string: 'texto',
  number: 'número',
  integer: 'número entero',
  float: 'número decimal',
  boolean: 'verdadero o falso',
  date: 'fecha',
  bigint: 'número entero grande',
  symbol: 'símbolo',
  undefined: 'un valor',
  null: 'nulo',
  object: 'objeto',
  array: 'lista',
  function: 'función',
  map: 'mapa',
  set: 'conjunto',
  promise: 'promesa',
  void: 'un valor',
  never: 'un valor',
  unknown: 'un valor',
  nan: 'un número válido',
}

function expectedLabel(expected: z.ZodParsedType): string {
  return EXPECTED_LABELS[expected] ?? 'un valor válido'
}

/** Mensajes de validación en español para todos los esquemas Zod de la plataforma. */
export const spanishErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Este campo es obligatorio' }
      return { message: `Se esperaba ${expectedLabel(issue.expected)}` }

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `Debe tener al menos ${issue.minimum} caracter(es)` }
      }
      if (issue.type === 'array') {
        return { message: `Debe incluir al menos ${issue.minimum} elemento(s)` }
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Debe ser mayor o igual a ${issue.minimum}` }
      }
      return { message: ctx.defaultError }

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Debe tener como máximo ${issue.maximum} caracter(es)` }
      }
      if (issue.type === 'array') {
        return { message: `Debe incluir como máximo ${issue.maximum} elemento(s)` }
      }
      if (issue.type === 'number' || issue.type === 'bigint') {
        return { message: `Debe ser menor o igual a ${issue.maximum}` }
      }
      return { message: ctx.defaultError }

    case z.ZodIssueCode.invalid_string:
      switch (issue.validation) {
        case 'email':
          return { message: 'Captura un correo electrónico válido' }
        case 'uuid':
          return { message: 'Captura un identificador válido' }
        case 'url':
          return { message: 'Captura una URL válida' }
        case 'date':
        case 'datetime':
          return { message: 'Captura una fecha válida' }
        case 'regex':
          return { message: 'El formato no es válido' }
        default:
          return { message: 'El formato no es válido' }
      }

    case z.ZodIssueCode.invalid_enum_value:
      return {
        message: `Opción no válida. Valores permitidos: ${issue.options.map((option) => String(option)).join(', ')}`,
      }

    case z.ZodIssueCode.invalid_literal:
      return { message: `El valor debe ser ${JSON.stringify(issue.expected)}` }

    case z.ZodIssueCode.unrecognized_keys:
      return {
        message: `Campos no reconocidos: ${issue.keys.join(', ')}`,
      }

    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_arguments:
    case z.ZodIssueCode.invalid_return_type:
    case z.ZodIssueCode.invalid_intersection_types:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: 'Los datos capturados no son válidos' }

    case z.ZodIssueCode.custom:
      return { message: issue.message ?? ctx.defaultError }

    default:
      return { message: ctx.defaultError }
  }
}

let configured = false

/** Instala el mapa de errores en español una sola vez por proceso. */
export function configureSpanishZodErrors(): void {
  if (configured) return
  z.setErrorMap(spanishErrorMap)
  configured = true
}
