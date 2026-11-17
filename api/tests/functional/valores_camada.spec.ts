import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import CamadasSeeder from '#database/seeders/camadas_seeder'
import env from '#start/env'

const CAMADA = 'superficie-construida'
/** Dois hexágonos de 500 m perto da Baixa de Luanda. O segundo só tem metade dentro da área. */
const HEX_INTEIRO = {
  id: 'h500_r12042_c347',
  wkt: 'POLYGON((13.1956 -8.8133,13.1997 -8.8156,13.1997 -8.8201,13.1956 -8.8224,13.1915 -8.8201,13.1915 -8.8156,13.1956 -8.8133))',
}
const HEX_METADE = {
  id: 'h500_r12042_c348',
  wkt: 'POLYGON((13.2038 -8.8133,13.2079 -8.8156,13.2079 -8.8201,13.2038 -8.8224,13.1997 -8.8201,13.1997 -8.8156,13.2038 -8.8133))',
}
const AREA_HEX_M2 = 649_519

async function preparar() {
  await db.rawQuery('DELETE FROM valores_camada')
  await db.rawQuery('DELETE FROM grelha_hexagonos')
  await db.rawQuery('DELETE FROM camadas')
  await new CamadasSeeder(db.connection()).run()

  for (const [hex, linha, coluna, fracao] of [
    [HEX_INTEIRO, 12042, 347, 1],
    [HEX_METADE, 12042, 348, 0.5],
  ] as const) {
    await db.rawQuery(
      `INSERT INTO grelha_hexagonos (id, lado_m, linha, coluna, area_km2, fracao_na_area, geom)
       VALUES (?, 500, ?, ?, ?, ?, ST_GeomFromText(?, 4326))`,
      [hex.id, linha, coluna, AREA_HEX_M2 / 1e6, fracao, hex.wkt]
    )
  }
  // 1975: 10% e 20% construídos; 2020: 50% e 100%; 2030 (projeção): 60% e 100%.
  const valores: [string, number, number][] = [
    [HEX_INTEIRO.id, 1975, 0.1 * AREA_HEX_M2],
    [HEX_METADE.id, 1975, 0.2 * 0.5 * AREA_HEX_M2],
    [HEX_INTEIRO.id, 2020, 0.5 * AREA_HEX_M2],
    [HEX_METADE.id, 2020, 1.0 * 0.5 * AREA_HEX_M2],
    [HEX_INTEIRO.id, 2030, 0.6 * AREA_HEX_M2],
    [HEX_METADE.id, 2030, 1.0 * 0.5 * AREA_HEX_M2],
  ]
  for (const [hex, ano, valor] of valores) {
    await db.rawQuery(
      'INSERT INTO valores_camada (camada_id, hexagono_id, ano, valor) VALUES (?, ?, ?, ?)',
      [CAMADA, hex, ano, valor]
    )
  }
  await db.rawQuery(
    `UPDATE camadas SET disponivel = true, anos = '{1975,2020,2030}' WHERE id = ?`,
    [CAMADA]
  )
}

async function limpar() {
  await db.rawQuery('DELETE FROM valores_camada')
  await db.rawQuery('DELETE FROM grelha_hexagonos')
}

test.group('Valores das camadas', (group) => {
  group.each.setup(async () => {
    await preparar()
    return limpar
  })

  test('o catálogo indica os anos carregados e o último ano observado', async ({
    client,
    assert,
  }) => {
    const { data } = (await client.get('/api/v1/camadas')).body()
    const camada = data.find((c: { id: string }) => c.id === CAMADA)
    assert.isTrue(camada.disponivel)
    assert.deepEqual(camada.anos.carregados, [1975, 2020, 2030])
    assert.equal(camada.anos.ultimoObservado, 2020)
    assert.equal(camada.unidade, 'm2')
    assert.lengthOf(camada.notas, 3)
    assert.match(camada.notas[1], /demolições/)
  })

  test('a série soma a área de estudo e assinala as projeções', async ({ client, assert }) => {
    const resposta = await client.get(`/api/v1/camadas/${CAMADA}/serie`)
    resposta.assertStatus(200)
    const serie = resposta.body().data
    assert.deepEqual(
      serie.map((p: { ano: number }) => p.ano),
      [1975, 2020, 2030]
    )
    // Área de estudo = 1,5 hexágonos. 1975: (0,10 + 0,10) / 1,5 = 13,33%.
    assert.closeTo(serie[0].percentagem, 13.33, 0.01)
    assert.closeTo(serie[1].percentagem, 66.67, 0.01)
    assert.isFalse(serie[1].projecao)
    assert.isTrue(serie[2].projecao)
  })

  test('a série de um hexágono usa só a parte dentro da área', async ({ client, assert }) => {
    const resposta = await client.get(`/api/v1/camadas/${CAMADA}/hexagonos/${HEX_METADE.id}`)
    resposta.assertStatus(200)
    const pontos = resposta.body().data
    assert.deepEqual(
      pontos.map((p: { percentagem: number }) => p.percentagem),
      [20, 100, 100]
    )
  })

  test('os tiles com camada levam a percentagem de cada ano', async ({ assert }) => {
    // O cliente de testes não devolve corpos binários: pedido direto ao servidor de testes.
    const resposta = await fetch(
      `http://${env.get('HOST')}:${env.get('PORT')}/api/v1/grelha/tiles/12/2198/2148?camada=${CAMADA}`
    )
    assert.equal(resposta.status, 200)
    const tile = new VectorTile(new Pbf(new Uint8Array(await resposta.arrayBuffer())))
    const camadaMvt = tile.layers.grelha
    const props: Record<string, Record<string, unknown>> = {}
    for (let i = 0; i < camadaMvt.length; i++) {
      const f = camadaMvt.feature(i).properties
      props[String(f.id)] = f
    }
    assert.equal(props[HEX_INTEIRO.id].a1975, 10)
    assert.equal(props[HEX_INTEIRO.id].a2020, 50)
    assert.equal(props[HEX_METADE.id].a1975, 20)
    assert.equal(props[HEX_METADE.id].a2030, 100)
  })

  test('erros claros para camada sem dados, inexistente ou ids inválidos', async ({ client }) => {
    ;(await client.get('/api/v1/camadas/edificios/serie')).assertBodyContains({
      error: { code: 'CAMADA_SEM_DADOS' },
    })
    ;(await client.get('/api/v1/camadas/nao-existe/serie')).assertStatus(404)
    ;(await client.get('/api/v1/camadas/Má_Camada/serie')).assertStatus(400)
    ;(await client.get(`/api/v1/camadas/${CAMADA}/hexagonos/x;drop`)).assertStatus(400)
    ;(await client.get(`/api/v1/camadas/${CAMADA}/hexagonos/h500_r1_c1`)).assertStatus(404)
    ;(
      await client.get('/api/v1/grelha/tiles/12/2198/2148').qs({ camada: 'edificios' })
    ).assertStatus(404)
  })
})
