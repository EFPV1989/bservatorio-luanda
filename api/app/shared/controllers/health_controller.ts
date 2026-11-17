import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { ok } from '#shared/http/response'
import { AppError } from '#shared/errors/app_error'

export default class HealthController {
  async live(ctx: HttpContext) {
    return ok(ctx, { status: 'ok' })
  }

  async ready(ctx: HttpContext) {
    try {
      await db.rawQuery('SELECT 1')
    } catch {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível.')
    }
    return ok(ctx, { status: 'ready', database: 'ok' })
  }
}
