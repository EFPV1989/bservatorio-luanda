import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Valores das camadas de dados por hexágono e por ano (por exemplo, m²
 * construídos segundo a GHSL). Tabela genérica: cada camada nova entra aqui
 * sem mudar a estrutura. Carregada pelo pipeline.
 */
export default class extends BaseSchema {
  protected tableName = 'valores_camada'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('camada_id').notNullable().references('id').inTable('camadas').onDelete('CASCADE')
      table
        .text('hexagono_id')
        .notNullable()
        .references('id')
        .inTable('grelha_hexagonos')
        .onDelete('CASCADE')
      table.integer('ano').notNullable()
      table.double('valor').notNullable()

      table.primary(['camada_id', 'hexagono_id', 'ano'])
      // Os tiles leem todos os anos de uma camada para os hexágonos de um tile.
      table.index(['hexagono_id', 'camada_id'])
    })

    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT valores_camada_valor_nao_negativo CHECK (valor >= 0)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
