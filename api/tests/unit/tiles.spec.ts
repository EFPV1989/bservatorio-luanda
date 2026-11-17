import { test } from '@japa/runner'
import { assertTileExiste, tileParamsValidator } from '#modules/territorio/validators'
import { AppError } from '#shared/errors/app_error'

test.group('Coordenadas de tiles', () => {
  test('aceita tiles dentro do zoom', ({ assert }) => {
    assert.doesNotThrow(() => assertTileExiste({ z: 0, x: 0, y: 0 }))
    assert.doesNotThrow(() => assertTileExiste({ z: 12, x: 4095, y: 4095 }))
  })

  test('recusa x ou y fora do zoom', ({ assert }) => {
    assert.throws(() => assertTileExiste({ z: 12, x: 4096, y: 0 }))
    try {
      assertTileExiste({ z: 1, x: 0, y: 2 })
      assert.fail('devia ter lançado')
    } catch (error) {
      assert.instanceOf(error, AppError)
      assert.equal((error as AppError).code, 'TILE_INVALID')
      assert.equal((error as AppError).status, 400)
    }
  })

  test('valida e converte os parâmetros da rota', async ({ assert }) => {
    assert.deepEqual(await tileParamsValidator.validate({ z: '12', x: '2198', y: '2147' }), {
      z: 12,
      x: 2198,
      y: 2147,
    })
    await assert.rejects(() => tileParamsValidator.validate({ z: '19', x: '0', y: '0' }))
    await assert.rejects(() => tileParamsValidator.validate({ z: '-1', x: '0', y: '0' }))
    await assert.rejects(() => tileParamsValidator.validate({ z: '1.5', x: '0', y: '0' }))
  })
})
