import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * Classes de cor para a percentagem de cada hexágono (0–100). A mesma tabela
 * alimenta o mapa e a legenda, para que nunca discordem.
 */
export interface ClasseCor {
  /** Limite inferior da classe, inclusive (%). */
  desde: number;
  cor: string;
  rotulo: string;
}

export const CLASSES_PERCENTAGEM: readonly ClasseCor[] = [
  { desde: 0, cor: '#f6efe7', rotulo: 'menos de 1%' },
  { desde: 1, cor: '#fcd9b6', rotulo: '1 a 10%' },
  { desde: 10, cor: '#f9b47f', rotulo: '10 a 25%' },
  { desde: 25, cor: '#f08a4b', rotulo: '25 a 50%' },
  { desde: 50, cor: '#d9601f', rotulo: '50 a 75%' },
  { desde: 75, cor: '#a63d0f', rotulo: '75% ou mais' },
];

export const COR_SEM_DADOS = '#cfcfcf';

/** Nome da propriedade do tile com o valor de um ano (definido pela API). */
export function propriedadeDoAno(ano: number): string {
  return `a${ano}`;
}

/** Expressão MapLibre que pinta cada hexágono pela classe da sua percentagem no `ano`. */
export function expressaoCor(ano: number): ExpressionSpecification {
  const [primeira, ...resto] = CLASSES_PERCENTAGEM;
  const degraus = resto.flatMap((classe) => [classe.desde, classe.cor]);
  return [
    'step',
    ['coalesce', ['get', propriedadeDoAno(ano)], -1],
    COR_SEM_DADOS,
    primeira.desde,
    primeira.cor,
    ...degraus,
  ] as ExpressionSpecification;
}

/** Classe de uma percentagem (para testes e para o painel). */
export function classeDe(percentagem: number | null | undefined): ClasseCor | null {
  if (percentagem === null || percentagem === undefined || percentagem < 0) return null;
  let atual = CLASSES_PERCENTAGEM[0];
  for (const classe of CLASSES_PERCENTAGEM) if (percentagem >= classe.desde) atual = classe;
  return atual;
}
