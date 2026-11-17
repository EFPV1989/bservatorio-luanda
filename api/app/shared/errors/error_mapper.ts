import { AppError, type ErrorFields } from '#shared/errors/app_error'

export interface MappedError {
  status: number
  code: string
  message: string
  fields?: ErrorFields
  headers?: Record<string, string>
}

const INTERNAL_ERROR: MappedError = {
  status: 500,
  code: 'INTERNAL_ERROR',
  message: 'Ocorreu um erro interno. Tente novamente mais tarde.',
}

type ErrorLike = {
  code?: unknown
  status?: unknown
  messages?: unknown
  routine?: unknown
  response?: { availableIn?: unknown }
}

function isObject(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null
}

function validationFields(messages: unknown): ErrorFields {
  const fields: ErrorFields = {}
  if (!Array.isArray(messages)) return fields

  for (const entry of messages) {
    if (!isObject(entry)) continue
    const { field, message } = entry as { field?: unknown; message?: unknown }
    if (typeof field !== 'string' || typeof message !== 'string') continue
    fields[field] ??= []
    fields[field].push(message)
  }
  return fields
}

/**
 * Traduz qualquer erro lançado na aplicação para o contrato público de erro.
 * Erros desconhecidos nunca expõem detalhes internos.
 */
export function mapError(error: unknown): MappedError {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      fields: error.fields,
      headers: error.headers,
    }
  }

  if (!isObject(error)) return INTERNAL_ERROR

  switch (error.code) {
    case 'E_VALIDATION_ERROR':
      return {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Os dados enviados são inválidos.',
        fields: validationFields(error.messages),
      }
    case 'E_UNAUTHORIZED_ACCESS':
      return { status: 401, code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' }
    case 'E_INVALID_CREDENTIALS':
      return { status: 401, code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' }
    case 'E_ROW_NOT_FOUND':
      return { status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Recurso não encontrado.' }
    case 'E_ROUTE_NOT_FOUND':
      return { status: 404, code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' }
    case 'E_TOO_MANY_REQUESTS': {
      const availableIn = Number(error.response?.availableIn)
      return {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Demasiados pedidos. Tente novamente mais tarde.',
        headers: Number.isFinite(availableIn) ? { 'Retry-After': String(availableIn) } : undefined,
      }
    }
  }

  // Erros do driver PostgreSQL (têm `routine`), sem divulgar constraint/detalhes.
  if (typeof error.routine === 'string') {
    switch (error.code) {
      case '23505':
        return {
          status: 409,
          code: 'CONFLICT',
          message: 'O recurso já existe ou está em conflito.',
        }
      case '23503':
        return { status: 422, code: 'INVALID_REFERENCE', message: 'Referência inválida.' }
      case '23514':
      case '23502':
      case 'P0001':
        return {
          status: 422,
          code: 'DOMAIN_RULE_VIOLATION',
          message: 'Operação viola uma regra de domínio.',
        }
      case '22P02':
        return { status: 400, code: 'INVALID_PAYLOAD', message: 'Formato de dados inválido.' }
    }
    return INTERNAL_ERROR
  }

  // Erros HTTP do framework (ex.: JSON malformado no body parser).
  const status = Number(error.status)
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return {
      status,
      code: status === 400 ? 'INVALID_PAYLOAD' : 'HTTP_ERROR',
      message: status === 400 ? 'Pedido inválido.' : 'Pedido não pode ser processado.',
    }
  }

  return INTERNAL_ERROR
}
