import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'

export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * A suite `unit` não precisa de BD. A suite `functional` aplica as migrations
 * na BD de testes (DB_DATABASE de .env.test) e arranca o servidor HTTP.
 * Nunca apontar .env.test para uma BD com dados reais.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    suite.setup(async () => {
      const { default: env } = await import('#start/env')
      if (!env.get('DB_DATABASE').endsWith('_test')) {
        throw new Error('Os testes funcionais só correm numa BD cujo nome termina em "_test".')
      }
    })
    suite.setup(() => testUtils.db().migrate())
    return suite.setup(() => testUtils.httpServer().start())
  }
}
