import type { HttpContext } from '@adonisjs/core/http'
import { ok } from '#shared/http/response'
import { CamadasService } from '#modules/camadas/services/camadas_service'

export default class CamadasController {
  private service = new CamadasService()

  /** GET /api/v1/camadas — catálogo das camadas de dados, com fonte e licença. */
  async index(ctx: HttpContext) {
    return ok(ctx, await this.service.listar())
  }
}
