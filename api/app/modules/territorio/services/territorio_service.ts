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

/** O que o tile precisa de saber da camada pedida. */
export interface CamadaNoTile {
  id: string
  unidade: string
  anos: number[]
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
   * Com `camada`, cada hexágono leva também uma propriedade por ano (`a1975`,
   * `a1980`, …): a percentagem do hexágono, nas camadas de área (m²), ou a
   * densidade por km², nas outras. Assim o site muda de ano sem pedir novos tiles.
   * Devolve `null` quando o zoom é baixo de mais ou não há hexágonos no tile.
   */
  async tileGrelha(
    ladoM: number,
    { z, x, y }: TileCoords,
    camada?: CamadaNoTile
  ): Promise<Buffer | null> {
    if (z < GRELHA_ZOOM_MINIMO) return null

    const anos = camada ? camada.anos.filter((ano) => Number.isInteger(ano)) : []
    // Camadas de área (m²): % do hexágono construída. Outras (ex.: pessoas): densidade por km².
    const expressao =
      camada?.unidade === 'm2'
        ? 'LEAST(100, round((100 * v.valor / (h.area_km2 * h.fracao_na_area * 1e6))::numeric, 1))'
        : 'round((v.valor / (h.area_km2 * h.fracao_na_area))::numeric, 0)'
    // Os anos vêm da base de dados como inteiros validados: é seguro pô-los no SQL.
    const colunasAnos = anos
      .map((ano) => `, max(${expressao}) FILTER (WHERE v.ano = ${ano})::float8 AS a${ano}`)
      .join('')
    const juncao = camada
      ? 'LEFT JOIN valores_camada v ON v.hexagono_id = h.id AND v.camada_id = ?'
      : ''

    const resultado = await db.rawQuery(
      `WITH limites AS (
         SELECT ST_TileEnvelope(?, ?, ?) AS env_3857
       ),
       mvt AS (
         SELECT h.id, h.fracao_na_area${colunasAnos},
                ST_AsMVTGeom(ST_Transform(h.geom, 3857), l.env_3857, 4096, 64, true) AS geom
           FROM grelha_hexagonos h
           CROSS JOIN limites l
           ${juncao}
          WHERE h.lado_m = ?
            AND h.geom && ST_Transform(l.env_3857, 4326)
          GROUP BY h.id, l.env_3857 -- h.id é chave primária: as outras colunas de h seguem-na
       )
       SELECT ST_AsMVT(mvt, ?, 4096, 'geom') AS tile
         FROM mvt
        WHERE geom IS NOT NULL`,
      [z, x, y, ...(camada ? [camada.id] : []), ladoM, GRELHA_CAMADA_MVT]
    )
    const tile: Buffer | null = resultado.rows[0]?.tile ?? null
    return tile && tile.length > 0 ? tile : null
  }
}
