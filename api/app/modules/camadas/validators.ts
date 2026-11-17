import vine from '@vinejs/vine'

/** Id de camada do catálogo, por exemplo "superficie-construida". */
export const ID_CAMADA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Id de hexágono gerado pelo pipeline, por exemplo "h500_r12042_c347". */
export const ID_HEXAGONO = /^h\d+_r-?\d+_c-?\d+$/

export const serieParamsValidator = vine.compile(
  vine.object({
    id: vine.string().maxLength(64).regex(ID_CAMADA),
  })
)

export const hexagonoParamsValidator = vine.compile(
  vine.object({
    id: vine.string().maxLength(64).regex(ID_CAMADA),
    hexagonoId: vine.string().maxLength(64).regex(ID_HEXAGONO),
  })
)
