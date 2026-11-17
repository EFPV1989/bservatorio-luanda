import db from '@adonisjs/lucid/services/db'

export interface Camada {
  id: string
  nome: string
  descricao: string
  fonte: { nome: string; url: string; licenca: string }
  anos: { inicio: number; fim: number }
  resolucao: string
  disponivel: boolean
}

export class CamadasService {
  async listar(): Promise<Camada[]> {
    const linhas = await db.from('camadas').orderBy('ordem', 'asc').orderBy('id', 'asc')
    return linhas.map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      descricao: linha.descricao,
      fonte: { nome: linha.fonte_nome, url: linha.fonte_url, licenca: linha.licenca },
      anos: { inicio: linha.ano_inicio, fim: linha.ano_fim },
      resolucao: linha.resolucao,
      disponivel: linha.disponivel,
    }))
  }
}
