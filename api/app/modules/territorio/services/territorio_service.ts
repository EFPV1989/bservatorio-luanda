import db from '@adonisjs/lucid/services/db'
import type { TileCoords } from '#modules/territorio/validators'

/**
 * Abaixo deste zoom os hexágonos de 500 m ficam com poucos píxeis e o tile
 * cobriria dezenas de milhares deles: o mapa mostra só o contorno da área.
 */
export const GRELHA_ZOOM_MINIMO = 10

/** Nome da camada dentro do tile vetorial (usado pelo site no MapLibre). */
export const GRELHA_CAMADA_MVT = 'grelha'

export interface AreaEstudoFeature {
  type: 'Feature'
  geometry: unknown
  properties: {
    nome: string
    fonte: string
    provisoria: boolean
    areaKm2: number
    carregadaEm: string
  }
}

export interface ResumoGrelha {
  ladoM: number
  hexagonos: number
  areaCobertaKm2: number
  /** [oeste, sul, este, norte] em graus (WGS84) */
  bbox: [number, number, number, number]
  zoomMinimo: number
}

export class TerritorioService {
  async areaEstudo(): Promise<AreaEstudoFeature | null> {
    const resultado = await db.rawQuery(
      `SELECT nome, fonte, provisoria, carregada_em,
              ST_AsGeoJSON(geom, 6)::json AS geometria,
              ST_Area(geom::geography) / 1e6 AS area_km2
         FROM area_estudo
        ORDER BY id DESC
        LIMIT 1`
    )
    const linha = resultado.rows[0]
    if (!linha) return null

    return {
      type: 'Feature',
      geometry: linha.geometria,
      properties: {
        nome: linha.nome,
        fonte: linha.fonte,
        provisoria: linha.provisoria,
        areaKm2: Math.round(Number(linha.area_km2)),
        carregadaEm: new Date(linha.carregada_em).toISOString(),
      },
    }
  }

  async resumoGrelha(ladoM: number): Promise<ResumoGrelha | null> {
    const resultado = await db.rawQuery(
      `SELECT count(*)::int AS hexagonos,
              sum(area_km2 * fracao_na_area) AS area_coberta_km2,
              ST_XMin(ST_Extent(geom)) AS oeste, ST_YMin(ST_Extent(geom)) AS sul,
              ST_XMax(ST_Extent(geom)) AS este, ST_YMax(ST_Extent(geom)) AS norte
         FROM grelha_hexagonos
        WHERE lado_m = ?`,
      [ladoM]
    )
    const linha = resultado.rows[0]
    if (!linha || linha.hexagonos === 0) return null

    const arredondar = (valor: unknown) => Math.round(Number(valor) * 1e6) / 1e6
    return {
      ladoM,
      hexagonos: linha.hexagonos,
      areaCobertaKm2: Math.round(Number(linha.area_coberta_km2)),
      bbox: [
        arredondar(linha.oeste),
        arredondar(linha.sul),
        arredondar(linha.este),
        arredondar(linha.norte),
      ],
      zoomMinimo: GRELHA_ZOOM_MINIMO,
    }
  }

  /**
   * Tile vetorial (Mapbox Vector Tile) com os hexágonos que caem no tile.
   * Devolve `null` quando o zoom é baixo de mais ou não há hexágonos no tile.
   */
  async tileGrelha(ladoM: number, { z, x, y }: TileCoords): Promise<Buffer | null> {
    if (z < GRELHA_ZOOM_MINIMO) return null

    const resultado = await db.rawQuery(
      `WITH limites AS (
         SELECT ST_TileEnvelope(?, ?, ?) AS env_3857
       ),
       mvt AS (
         SELECT h.id, h.fracao_na_area,
                ST_AsMVTGeom(ST_Transform(h.geom, 3857), l.env_3857, 4096, 64, true) AS geom
           FROM grelha_hexagonos h, limites l
          WHERE h.lado_m = ?
            AND h.geom && ST_Transform(l.env_3857, 4326)
       )
       SELECT ST_AsMVT(mvt, ?, 4096, 'geom') AS tile
         FROM mvt
        WHERE geom IS NOT NULL`,
      [z, x, y, ladoM, GRELHA_CAMADA_MVT]
    )
    const tile: Buffer | null = resultado.rows[0]?.tile ?? null
    return tile && tile.length > 0 ? tile : null
  }
}
