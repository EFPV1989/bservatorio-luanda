import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Grelha de análise: hexágonos regulares gerados pelo pipeline. O `id` é
 * estável (deriva da posição no sistema UTM 33S), por isso os dados de anos
 * diferentes ligam-se sempre ao mesmo hexágono.
 */
export default class extends BaseSchema {
  protected tableName = 'grelha_hexagonos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.text('id').primary()
      table.integer('lado_m').notNullable()
      table.integer('linha').notNullable()
      table.integer('coluna').notNullable()
      table.double('area_km2').notNullable()
      table.double('fracao_na_area').notNullable()
      table.specificType('geom', 'geometry(Polygon, 4326)').notNullable()

      table.unique(['lado_m', 'linha', 'coluna'])
      table.index(['lado_m'])
    })

    this.schema.raw(`
      ALTER TABLE ${this.tableName}
        ADD CONSTRAINT grelha_lado_positivo CHECK (lado_m > 0),
        ADD CONSTRAINT grelha_fracao_valida CHECK (fracao_na_area > 0 AND fracao_na_area <= 1)
    `)
    this.schema.raw(`CREATE INDEX grelha_hexagonos_geom_idx ON ${this.tableName} USING GIST (geom)`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
