import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * - `unidade`: o que `valores_camada.valor` mede ('m2' de área, 'pessoas', …).
 *   Para camadas em m² a API também devolve a percentagem do hexágono.
 * - `ano_ultimo_observado`: anos depois deste são projeções (ex.: GHSL 2025 e 2030).
 * - `anos`: anos com valores carregados; preenchido pelo pipeline em cada carga.
 */
export default class extends BaseSchema {
  protected tableName = 'camadas'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('unidade').notNullable().defaultTo('m2')
      table.integer('ano_ultimo_observado').nullable()
      table.specificType('anos', 'integer[]').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('unidade')
      table.dropColumn('ano_ultimo_observado')
      table.dropColumn('anos')
    })
  }
}
