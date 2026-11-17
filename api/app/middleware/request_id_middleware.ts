import { randomUUID } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import '#shared/http/context'

const ACCEPTED_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/

/**
 * Atribui um request id a cada pedido. Um `x-request-id` recebido só é
 * reutilizado se tiver formato seguro, para não poluir logs.
 */
export default class RequestIdMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const incoming = ctx.request.header('x-request-id')
    const requestId =
      incoming && ACCEPTED_REQUEST_ID.test(incoming) ? incoming : `req_${randomUUID()}`

    ctx.requestId = requestId
    // O framework copia este header do pedido para a resposta ao finalizar;
    // normalizá-lo aqui impede que um valor inválido seja devolvido.
    ctx.request.request.headers['x-request-id'] = requestId
    ctx.logger = ctx.logger.child({ request_id: requestId })
    ctx.response.header('x-request-id', requestId)

    return next()
  }
}
