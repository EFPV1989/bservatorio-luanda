import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * O PostGIS dá ao PostgreSQL os tipos e funções geográficas (geometria,
 * índices espaciais, tiles vetoriais).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS postgis')
  }

  async down() {
    // Não remover a extensão: pode ser usada por outras tabelas da base de dados.
  }
}
