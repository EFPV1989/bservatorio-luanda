import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { mapError } from '#shared/errors/error_mapper'
import '#shared/http/context'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  /**
   * Todas as respostas de erro seguem o envelope
   * `{ success: false, error: { code, message, fields? }, meta: { requestId } }`.
   */
  async handle(error: unknown, ctx: HttpContext) {
    const mapped = mapError(error)
    const requestId = ctx.requestId ?? `req_${randomUUID()}`

    for (const [name, value] of Object.entries(mapped.headers ?? {})) {
      ctx.response.header(name, value)
    }

    return ctx.response.status(mapped.status).send({
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.fields && Object.keys(mapped.fields).length > 0
          ? { fields: mapped.fields }
          : {}),
      },
      meta: { requestId },
    })
  }

  /**
   * Apenas erros 5xx são reportados como erro; os 4xx são esperados.
   */
  async report(error: unknown, ctx: HttpContext) {
    if (mapError(error).status < 500) return
    ctx.logger.error({ err: error }, 'Unhandled error')
  }
}
