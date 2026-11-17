import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

const configuredOrigins = (env.get('CORS_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

/**
 * A API é pública e só de leitura: não há cookies nem credenciais.
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: configuredOrigins.length > 0 ? configuredOrigins : !app.inProduction,
  methods: ['GET', 'HEAD'],
  headers: true,
  exposeHeaders: ['x-request-id'],
  credentials: false,
  maxAge: 90,
})

export default corsConfig
