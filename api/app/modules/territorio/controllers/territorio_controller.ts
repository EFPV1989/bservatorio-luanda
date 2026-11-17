import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { ok } from '#shared/http/response'
import { AppError } from '#shared/errors/app_error'
import { TerritorioService } from '#modules/territorio/services/territorio_service'
import { assertTileExiste, tileParamsValidator } from '#modules/territorio/validators'

const ladoM = () => env.get('GRELHA_LADO_M', 500)

export default class TerritorioController {
  private service = new TerritorioService()

  /** GET /api/v1/area-estudo — contorno da área de estudo (GeoJSON Feature). */
  async areaEstudo(ctx: HttpContext) {
    const area = await this.service.areaEstudo()
    if (!area) {
      throw AppError.notFound('AREA_ESTUDO_NOT_LOADED', 'A área de estudo ainda não foi carregada.')
    }
    return ok(ctx, area)
  }

  /** GET /api/v1/grelha — resumo da grelha de análise. */
  async grelha(ctx: HttpContext) {
    const resumo = await this.service.resumoGrelha(ladoM())
    if (!resumo) {
      throw AppError.notFound('GRELHA_NOT_LOADED', 'A grelha de análise ainda não foi carregada.')
    }
    return ok(ctx, resumo)
  }

  /** GET /api/v1/grelha/tiles/:z/:x/:y — tile vetorial da grelha. */
  async tile(ctx: HttpContext) {
    const coords = await tileParamsValidator.validate(ctx.params)
    assertTileExiste(coords)

    const tile = await this.service.tileGrelha(ladoM(), coords)
    ctx.response.header('Cache-Control', 'public, max-age=3600')
    if (!tile) {
      // 204 = tile vazio; o MapLibre trata-o como "nada a desenhar aqui".
      return ctx.response.status(204).send('')
    }
    ctx.response.header('Content-Type', 'application/vnd.mapbox-vector-tile')
    return ctx.response.status(200).send(tile)
  }
}
