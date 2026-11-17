import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Catálogo das camadas de dados que o mapa pode mostrar, com a fonte e a
 * licença de cada uma. `disponivel` passa a verdadeiro quando os dados da
 * camada estiverem carregados.
 */
export default class extends BaseSchema {
  protected tableName = 'camadas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table.text('nome').notNullable()
      table.text('descricao').notNullable()
      table.text('fonte_nome').notNullable()
      table.text('fonte_url').notNullable()
      table.text('licenca').notNullable()
      table.integer('ano_inicio').notNullable()
      table.integer('ano_fim').notNullable()
      table.text('resolucao').notNullable()
      table.boolean('disponivel').notNullable().defaultTo(false)
      table.integer('ordem').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })

    this.schema.raw(
      `ALTER TABLE ${this.tableName} ADD CONSTRAINT camadas_anos_validos CHECK (ano_fim >= ano_inicio)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
