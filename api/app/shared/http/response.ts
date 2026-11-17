import type { HttpContext } from '@adonisjs/core/http'
import '#shared/http/context'

/**
 * Subconjunto comum aos paginadores do query builder e dos modelos Lucid.
 */
export interface Paginator<T> {
  currentPage: number
  perPage: number
  total: number
  lastPage: number
  all(): T[]
}

export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  lastPage: number
}

/**
 * Envelope de sucesso: `{ success, data, meta: { requestId, ... } }`.
 */
export function ok<T>(ctx: HttpContext, data: T, status = 200, meta: Record<string, unknown> = {}) {
  return ctx.response.status(status).send({
    success: true,
    data,
    meta: { requestId: ctx.requestId, ...meta },
  })
}

export function created<T>(ctx: HttpContext, data: T) {
  return ok(ctx, data, 201)
}

export function paginated<T, R>(ctx: HttpContext, paginator: Paginator<T>, map: (row: T) => R) {
  const pagination: PaginationMeta = {
    page: paginator.currentPage,
    perPage: paginator.perPage,
    total: paginator.total,
    lastPage: paginator.lastPage,
  }
  return ok(ctx, paginator.all().map(map), 200, { pagination })
}
