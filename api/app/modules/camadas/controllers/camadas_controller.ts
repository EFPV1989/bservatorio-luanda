import type { HttpContext } from '@adonisjs/core/http'
import { ok } from '#shared/http/response'
import { CamadasService } from '#modules/camadas/services/camadas_service'
import { hexagonoParamsValidator, serieParamsValidator } from '#modules/camadas/validators'

export default class CamadasController {
  private service = new CamadasService()

  /** GET /api/v1/camadas — catálogo das camadas de dados, com fonte e licença. */
  async index(ctx: HttpContext) {
    return ok(ctx, await this.service.listar())
  }

  /** GET /api/v1/camadas/:id/serie — total na área de estudo, ano a ano. */
  async serie(ctx: HttpContext) {
    const { id } = await serieParamsValidator.validate(ctx.params)
    return ok(ctx, await this.service.serie(id))
  }

  /** GET /api/v1/camadas/:id/hexagonos/:hexagonoId — valores de um hexágono, ano a ano. */
  async hexagono(ctx: HttpContext) {
    const { id, hexagonoId } = await hexagonoParamsValidator.validate(ctx.params)
    return ok(ctx, await this.service.hexagono(id, hexagonoId))
  }
}
