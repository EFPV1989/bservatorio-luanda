export type ErrorFields = Record<string, string[]>

export interface AppErrorOptions {
  fields?: ErrorFields
  headers?: Record<string, string>
  cause?: unknown
}

/**
 * Erro de aplicação com código estável. O `code` é contrato público da API
 * e não deve mudar depois de publicado; a `message` é para humanos.
 */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: ErrorFields
  readonly headers?: Record<string, string>

  constructor(status: number, code: string, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = options.fields
    this.headers = options.headers
  }

  static badRequest(code: string, message: string, options?: AppErrorOptions) {
    return new AppError(400, code, message, options)
  }

  static unauthenticated(
    code = 'UNAUTHENTICATED',
    message = 'Autenticação necessária.',
    options?: AppErrorOptions
  ) {
    return new AppError(401, code, message, options)
  }

  static forbidden(
    code = 'FORBIDDEN',
    message = 'Não tem permissão para executar esta operação.',
    options?: AppErrorOptions
  ) {
    return new AppError(403, code, message, options)
  }

  /**
   * Usado também para recursos que existem mas estão fora do escopo do
   * utilizador, para não revelar a sua existência.
   */
  static notFound(
    code = 'RESOURCE_NOT_FOUND',
    message = 'Recurso não encontrado.',
    options?: AppErrorOptions
  ) {
    return new AppError(404, code, message, options)
  }

  static conflict(code: string, message: string, options?: AppErrorOptions) {
    return new AppError(409, code, message, options)
  }

  static unprocessable(code: string, message: string, options?: AppErrorOptions) {
    return new AppError(422, code, message, options)
  }
}
