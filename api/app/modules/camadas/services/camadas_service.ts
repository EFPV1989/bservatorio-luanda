import db from '@adonisjs/lucid/services/db'
import { AppError } from '#shared/errors/app_error'

export interface Camada {
  id: string
  nome: string
  descricao: string
  fonte: { nome: string; url: string; licenca: string }
  anos: { inicio: number; fim: number; ultimoObservado: number | null; carregados: number[] }
  resolucao: string
  unidade: string
  /** Limitações da fonte, em frases curtas para o leitor. */
  notas: string[]
  disponivel: boolean
}

export interface PontoSerie {
  ano: number
  /** Soma do valor na área de estudo, na unidade da camada (m² ou pessoas). */
  total: number
  /** Só em camadas de área (m²): parte da área de estudo, em %. */
  percentagem: number | null
  projecao: boolean
}

export interface PontoHexagono {
  ano: number
  valor: number
  percentagem: number | null
  projecao: boolean
}

interface LinhaCamada {
  id: string
  nome: string
  descricao: string
  fonte_nome: string
  fonte_url: string
  licenca: string
  ano_inicio: number
  ano_fim: number
  ano_ultimo_observado: number | null
  anos: number[]
  resolucao: string
  unidade: string
  notas: string[] | null
  disponivel: boolean
}

const arredondar = (valor: number, casas: number) => {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

function paraCamada(linha: LinhaCamada): Camada {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    fonte: { nome: linha.fonte_nome, url: linha.fonte_url, licenca: linha.licenca },
    anos: {
      inicio: linha.ano_inicio,
      fim: linha.ano_fim,
      ultimoObservado: linha.ano_ultimo_observado,
      carregados: linha.anos ?? [],
    },
    resolucao: linha.resolucao,
    unidade: linha.unidade,
    notas: linha.notas ?? [],
    disponivel: linha.disponivel,
  }
}

export class CamadasService {
  async listar(): Promise<Camada[]> {
    const linhas = await db.from('camadas').orderBy('ordem', 'asc').orderBy('id', 'asc')
    return linhas.map(paraCamada)
  }

  /** A camada, se existir e já tiver dados carregados; caso contrário, um erro claro. */
  async disponivel(id: string): Promise<Camada> {
    const linha = await db.from('camadas').where('id', id).first()
    if (!linha) {
      throw AppError.notFound('CAMADA_NOT_FOUND', 'Camada não encontrada.')
    }
    const camada = paraCamada(linha)
    if (!camada.disponivel || camada.anos.carregados.length === 0) {
      throw AppError.notFound('CAMADA_SEM_DADOS', 'Esta camada ainda não tem dados carregados.')
    }
    return camada
  }

  /** Total da camada na área de estudo, ano a ano. */
  async serie(id: string): Promise<PontoSerie[]> {
    const camada = await this.disponivel(id)
    const resultado = await db.rawQuery(
      // O pipeline grava um valor por hexágono e por ano, por isso a soma das
      // áreas dos hexágonos de cada ano é a área de estudo.
      `SELECT v.ano,
              sum(v.valor) AS total,
              sum(h.area_km2 * h.fracao_na_area) * 1e6 AS area_m2
         FROM valores_camada v
         JOIN grelha_hexagonos h ON h.id = v.hexagono_id
        WHERE v.camada_id = ?
        GROUP BY v.ano
        ORDER BY v.ano`,
      [id]
    )
    return resultado.rows.map((linha: { ano: number; total: string; area_m2: string }) => {
      const total = Number(linha.total)
      return {
        ano: linha.ano,
        total: arredondar(total, 0),
        percentagem:
          camada.unidade === 'm2' ? arredondar((100 * total) / Number(linha.area_m2), 2) : null,
        projecao: this.ehProjecao(camada, linha.ano),
      }
    })
  }

  /** Valores de um hexágono, ano a ano. */
  async hexagono(id: string, hexagonoId: string): Promise<PontoHexagono[]> {
    const camada = await this.disponivel(id)
    const resultado = await db.rawQuery(
      `SELECT v.ano, v.valor, h.area_km2 * h.fracao_na_area * 1e6 AS area_m2
         FROM valores_camada v
         JOIN grelha_hexagonos h ON h.id = v.hexagono_id
        WHERE v.camada_id = ? AND v.hexagono_id = ?
        ORDER BY v.ano`,
      [id, hexagonoId]
    )
    if (resultado.rows.length === 0) {
      throw AppError.notFound('HEXAGONO_NOT_FOUND', 'Hexágono sem valores nesta camada.')
    }
    return resultado.rows.map((linha: { ano: number; valor: number; area_m2: number }) => ({
      ano: linha.ano,
      valor: arredondar(Number(linha.valor), 0),
      percentagem:
        camada.unidade === 'm2'
          ? arredondar(Math.min(100, (100 * Number(linha.valor)) / Number(linha.area_m2)), 1)
          : null,
      projecao: this.ehProjecao(camada, linha.ano),
    }))
  }

  private ehProjecao(camada: Camada, ano: number) {
    return camada.anos.ultimoObservado !== null && ano > camada.anos.ultimoObservado
  }
}
