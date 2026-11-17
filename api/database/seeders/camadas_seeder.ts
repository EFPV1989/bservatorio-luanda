import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

/**
 * Camadas previstas no documento do projeto. Todas começam indisponíveis:
 * passam a disponíveis quando o pipeline carregar os seus dados.
 * Idempotente: pode correr várias vezes sem duplicar.
 */
export const CAMADAS = [
  {
    id: 'superficie-construida',
    nome: 'Superfície construída',
    descricao: 'Parte de cada hexágono coberta por construção, de 5 em 5 anos.',
    fonte_nome: 'GHSL GHS-BUILT-S (Comissão Europeia, JRC)',
    fonte_url: 'https://human-settlement.emergency.copernicus.eu/ghs_buS2023.php',
    licenca: 'CC BY 4.0',
    ano_inicio: 1975,
    ano_fim: 2030,
    resolucao: '100 m',
    ordem: 1,
  },
  {
    id: 'edificios',
    nome: 'Edifícios',
    descricao: 'Número e altura estimados de edifícios, ano a ano.',
    fonte_nome: 'Open Buildings 2.5D Temporal (Google Research)',
    fonte_url: 'https://sites.research.google/gr/open-buildings/temporal',
    licenca: 'CC BY 4.0 e ODbL',
    ano_inicio: 2016,
    ano_fim: 2023,
    resolucao: '4 m',
    ordem: 2,
  },
  {
    id: 'populacao',
    nome: 'População estimada',
    descricao: 'População residente estimada por modelo, ano a ano.',
    fonte_nome: 'WorldPop (Universidade de Southampton)',
    fonte_url: 'https://www.worldpop.org/',
    licenca: 'CC BY 4.0',
    ano_inicio: 2015,
    ano_fim: 2030,
    resolucao: '100 m',
    ordem: 3,
  },
] as const

export default class extends BaseSeeder {
  async run() {
    // `disponivel` não é atualizado num conflito: é o pipeline que o liga.
    for (const c of CAMADAS) {
      await db.rawQuery(
        `INSERT INTO camadas
           (id, nome, descricao, fonte_nome, fonte_url, licenca, ano_inicio, ano_fim, resolucao, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
           fonte_nome = EXCLUDED.fonte_nome, fonte_url = EXCLUDED.fonte_url,
           licenca = EXCLUDED.licenca, ano_inicio = EXCLUDED.ano_inicio,
           ano_fim = EXCLUDED.ano_fim, resolucao = EXCLUDED.resolucao,
           ordem = EXCLUDED.ordem, updated_at = now()`,
        [
          c.id,
          c.nome,
          c.descricao,
          c.fonte_nome,
          c.fonte_url,
          c.licenca,
          c.ano_inicio,
          c.ano_fim,
          c.resolucao,
          c.ordem,
        ]
      )
    }
  }
}
