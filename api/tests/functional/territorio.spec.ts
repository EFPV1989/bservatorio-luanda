import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/** Hexágono de 500 m perto da Baixa de Luanda (gerado pelo pipeline). */
const HEXAGONO = {
  id: 'h500_r12042_c347',
  linha: 12042,
  coluna: 347,
  wkt: 'POLYGON((13.1956 -8.8133,13.1997 -8.8156,13.1997 -8.8201,13.1956 -8.8224,13.1915 -8.8201,13.1915 -8.8156,13.1956 -8.8133))',
}

async function limpar() {
  await db.rawQuery('DELETE FROM grelha_hexagonos')
  await db.rawQuery('DELETE FROM area_estudo')
}

async function carregarFixtures() {
  await db.rawQuery(
    `INSERT INTO area_estudo (nome, fonte, provisoria, geom)
     VALUES ('Área de teste', 'teste', true,
             ST_Multi(ST_GeomFromText('POLYGON((13.1 -8.9,13.3 -8.9,13.3 -8.7,13.1 -8.7,13.1 -8.9))', 4326)))`
  )
  await db.rawQuery(
    `INSERT INTO grelha_hexagonos (id, lado_m, linha, coluna, area_km2, fracao_na_area, geom)
     VALUES (?, 500, ?, ?, 0.649519, 1, ST_GeomFromText(?, 4326))`,
    [HEXAGONO.id, HEXAGONO.linha, HEXAGONO.coluna, HEXAGONO.wkt]
  )
}

test.group('Território sem dados carregados', (group) => {
  group.each.setup(limpar)

  test('area-estudo devolve 404 com código estável', async ({ client }) => {
    const resposta = await client.get('/api/v1/area-estudo')
    resposta.assertStatus(404)
    resposta.assertBodyContains({ success: false, error: { code: 'AREA_ESTUDO_NOT_LOADED' } })
  })

  test('grelha devolve 404 com código estável', async ({ client }) => {
    const resposta = await client.get('/api/v1/grelha')
    resposta.assertStatus(404)
    resposta.assertBodyContains({ error: { code: 'GRELHA_NOT_LOADED' } })
  })
})

test.group('Território com dados carregados', (group) => {
  group.each.setup(async () => {
    await limpar()
    await carregarFixtures()
    return limpar
  })

  test('area-estudo devolve um GeoJSON Feature marcado como provisório', async ({
    client,
    assert,
  }) => {
    const resposta = await client.get('/api/v1/area-estudo')
    resposta.assertStatus(200)
    const { data } = resposta.body()
    assert.equal(data.type, 'Feature')
    assert.equal(data.geometry.type, 'MultiPolygon')
    assert.isTrue(data.properties.provisoria)
    assert.isAbove(data.properties.areaKm2, 0)
  })

  test('grelha resume os hexágonos carregados', async ({ client, assert }) => {
    const resposta = await client.get('/api/v1/grelha')
    resposta.assertStatus(200)
    const { data } = resposta.body()
    assert.equal(data.ladoM, 500)
    assert.equal(data.hexagonos, 1)
    assert.lengthOf(data.bbox, 4)
    assert.equal(data.zoomMinimo, 10)
  })

  test('tile com o hexágono devolve um vector tile', async ({ client, assert }) => {
    // Tile do zoom 12 que contém a Baixa de Luanda (13.19 E, 8.82 S).
    const resposta = await client.get('/api/v1/grelha/tiles/12/2198/2148')
    resposta.assertStatus(200)
    resposta.assertHeader('content-type', 'application/vnd.mapbox-vector-tile')
    assert.isAbove(Number(resposta.header('content-length')), 0)
  })

  test('tile sem hexágonos ou com zoom baixo devolve 204', async ({ client }) => {
    ;(await client.get('/api/v1/grelha/tiles/12/0/0')).assertStatus(204)
    ;(await client.get('/api/v1/grelha/tiles/9/274/268')).assertStatus(204)
  })

  test('tile com coordenadas impossíveis devolve 400', async ({ client }) => {
    const resposta = await client.get('/api/v1/grelha/tiles/12/4096/0')
    resposta.assertStatus(400)
    resposta.assertBodyContains({ error: { code: 'TILE_INVALID' } })
    ;(await client.get('/api/v1/grelha/tiles/25/0/0')).assertStatus(400)
  })
})
