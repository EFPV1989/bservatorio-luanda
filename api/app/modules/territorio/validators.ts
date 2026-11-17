import vine from '@vinejs/vine'
import { AppError } from '#shared/errors/app_error'

/** Zoom máximo aceite nos tiles (acima disto um hexágono de 500 m ocupa o ecrã inteiro). */
export const ZOOM_MAXIMO = 18

export const tileParamsValidator = vine.compile(
  vine.object({
    z: vine.number().withoutDecimals().min(0).max(ZOOM_MAXIMO),
    x: vine.number().withoutDecimals().min(0),
    y: vine.number().withoutDecimals().min(0),
  })
)

export interface TileCoords {
  z: number
  x: number
  y: number
}

/**
 * Num zoom `z` existem 2^z tiles por eixo: x e y vão de 0 a 2^z - 1.
 */
export function assertTileExiste({ z, x, y }: TileCoords) {
  const limite = 2 ** z
  if (x >= limite || y >= limite) {
    throw AppError.badRequest(
      'TILE_INVALID',
      `No zoom ${z}, x e y têm de estar entre 0 e ${limite - 1}.`
    )
  }
}
