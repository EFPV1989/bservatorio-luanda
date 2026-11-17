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
  anos: { inicio: number; fim: number };
  resolucao: string;
  disponivel: boolean;
}
