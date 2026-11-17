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
    unidade: 'm2',
    ano_ultimo_observado: 2020,
    notas: [
      'Estimativas a partir de imagens de satélite de 1975, 1990, 2000, 2014 (Landsat) e 2018 (Sentinel-2); os outros anos são interpolados e 2025 e 2030 são projeções.',
      'A série só regista construção nova: não mostra demolições.',
      'A precisão é mais baixa nesta região: 86,4% na África Central e 83,8% na África Austral, segundo a avaliação da própria fonte.',
    ],
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
    unidade: 'm2',
    ano_ultimo_observado: 2023,
    notas: [],
    ordem: 2,
  },
  {
    id: 'populacao',
    nome: 'População estimada',
    descricao: 'População residente estimada por modelo, ano a ano.',
    fonte_nome: 'WorldPop (Universidade de Southampton)',
    fonte_url: 'https://hub.worldpop.org/geodata/listing?id=135',
    licenca: 'CC BY 4.0',
    ano_inicio: 2015,
    ano_fim: 2030,
    resolucao: '100 m',
    unidade: 'pessoas',
    ano_ultimo_observado: null,
    notas: [
      'Estimativas de um modelo que distribui totais de população pelas zonas com construção; não é uma contagem.',
      'A versão R2025A é uma versão alfa e pode mudar ao longo do próximo ano.',
    ],
    ordem: 3,
  },
] as const

export default class extends BaseSeeder {
  async run() {
    // `disponivel` e `anos` não são atualizados num conflito: é o pipeline que os define.
    for (const c of CAMADAS) {
      await db.rawQuery(
        `INSERT INTO camadas
           (id, nome, descricao, fonte_nome, fonte_url, licenca, ano_inicio, ano_fim, resolucao,
            unidade, ano_ultimo_observado, notas, ordem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
           fonte_nome = EXCLUDED.fonte_nome, fonte_url = EXCLUDED.fonte_url,
           licenca = EXCLUDED.licenca, ano_inicio = EXCLUDED.ano_inicio,
           ano_fim = EXCLUDED.ano_fim, resolucao = EXCLUDED.resolucao,
           unidade = EXCLUDED.unidade, ano_ultimo_observado = EXCLUDED.ano_ultimo_observado,
           notas = EXCLUDED.notas,
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
          c.unidade,
          c.ano_ultimo_observado,
          [...c.notas],
          c.ordem,
        ]
      )
    }
  }
}
