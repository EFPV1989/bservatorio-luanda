import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Limitações de cada camada, em frases curtas para o leitor (ex.: "não mostra
 * demolições"). Vêm do documento técnico da fonte e aparecem no site junto à camada.
 */
export default class extends BaseSchema {
  protected tableName = 'camadas'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.specificType('notas', 'text[]').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('notas')
    })
  }
}
