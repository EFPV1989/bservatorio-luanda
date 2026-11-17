import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * Chave da aplicação (exigida pelo AdonisJS para cookies assinados e encriptação).
 * Perder ou trocar a chave invalida dados encriptados existentes.
 */
export const appKey = new Secret(env.get('APP_KEY'))

/**
 * O request id é gerido por `request_id_middleware`, que valida o valor
 * recebido em `x-request-id` antes de o usar nos logs.
 */
export const http = defineConfig({
  generateRequestId: false,
  allowMethodSpoofing: false,
  useAsyncLocalStorage: false,

  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
