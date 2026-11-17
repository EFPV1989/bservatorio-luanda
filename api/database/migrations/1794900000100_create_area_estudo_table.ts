import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Área de estudo: o contorno fixo usado em todos os anos (a antiga província
 * de Luanda, limites de 2011). Carregada pelo pipeline; `provisoria` marca
 * um contorno aproximado que ainda não veio de uma fonte oficial.
 */
export default class extends BaseSchema {
  protected tableName = 'area_estudo'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('nome').notNullable()
      table.text('fonte').notNullable()
      table.boolean('provisoria').notNullable().defaultTo(false)
      table.specificType('geom', 'geometry(MultiPolygon, 4326)').notNullable()
      table.timestamp('carregada_em', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
