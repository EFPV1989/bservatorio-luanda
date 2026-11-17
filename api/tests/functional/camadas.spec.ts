import { test } from '@japa/runner'
import CamadasSeeder, { CAMADAS } from '#database/seeders/camadas_seeder'
import db from '@adonisjs/lucid/services/db'

test.group('Catálogo de camadas', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('DELETE FROM camadas')
    await new CamadasSeeder(db.connection()).run()
  })

  test('lista as camadas por ordem, com fonte e licença', async ({ client, assert }) => {
    const resposta = await client.get('/api/v1/camadas')
    resposta.assertStatus(200)
    const { data } = resposta.body()
    assert.deepEqual(
      data.map((c: { id: string }) => c.id),
      CAMADAS.map((c) => c.id)
    )
    for (const camada of data) {
      assert.isNotEmpty(camada.fonte.nome)
      assert.match(camada.fonte.url, /^https:\/\//)
      assert.isNotEmpty(camada.fonte.licenca)
      assert.isAtMost(camada.anos.inicio, camada.anos.fim)
      assert.isFalse(camada.disponivel)
    }
  })

  test('o seeder é idempotente e não liga camadas', async ({ assert }) => {
    await db.rawQuery(`UPDATE camadas SET disponivel = true WHERE id = 'edificios'`)
    await new CamadasSeeder(db.connection()).run()
    const linhas = await db.from('camadas').select('id', 'disponivel')
    assert.lengthOf(linhas, CAMADAS.length)
    assert.isTrue(linhas.find((l) => l.id === 'edificios')!.disponivel)
  })
})
