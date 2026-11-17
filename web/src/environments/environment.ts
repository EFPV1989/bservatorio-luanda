/**
 * Configuração de produção. O endereço da API é relativo: em produção o
 * site e a API ficam no mesmo domínio (a API em /api/v1).
 */
export const environment = {
  apiUrl: '/api/v1',
  /** Estilo do mapa de base (OpenFreeMap: gratuito, sem chave, dados OpenStreetMap). */
  estiloMapaBase: 'https://tiles.openfreemap.org/styles/positron',
};
