import type { MultiPolygon } from 'geojson';

/** Envelope de sucesso da API: `{ success, data, meta }`. */
export interface RespostaApi<T> {
  success: true;
  data: T;
  meta: { requestId: string };
}

export interface AreaEstudo {
  type: 'Feature';
  geometry: MultiPolygon;
  properties: {
    nome: string;
    fonte: string;
    provisoria: boolean;
    areaKm2: number;
    carregadaEm: string;
  };
}

export interface ResumoGrelha {
  ladoM: number;
  hexagonos: number;
  areaCobertaKm2: number;
  /** [oeste, sul, este, norte] em graus */
  bbox: [number, number, number, number];
  zoomMinimo: number;
}

export interface Camada {
  id: string;
  nome: string;
  descricao: string;
  fonte: { nome: string; url: string; licenca: string };
  anos: {
    inicio: number;
    fim: number;
    /** Anos depois deste são projeções; `null` se a fonte não o indica. */
    ultimoObservado: number | null;
    /** Anos com dados carregados. */
    carregados: number[];
  };
  resolucao: string;
  /** O que o valor mede: 'm2' (área) ou 'pessoas'. */
  unidade: string;
  /** Limitações da fonte, em frases curtas para o leitor. */
  notas: string[];
  disponivel: boolean;
}

/** Total da camada na área de estudo num ano. */
export interface PontoSerie {
  ano: number;
  total: number;
  /** Só em camadas de área (m²): parte da área de estudo, em %. */
  percentagem: number | null;
  /** Só nas outras camadas (ex.: pessoas): valor por km². */
  densidade: number | null;
  projecao: boolean;
}

/** Valor da camada num hexágono num ano. */
export interface PontoHexagono {
  ano: number;
  valor: number;
  percentagem: number | null;
  densidade: number | null;
  projecao: boolean;
}
