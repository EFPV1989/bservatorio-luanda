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

/** Densidade populacional (pessoas por km²). Tons de roxo, para não confundir com a construção. */
export const CLASSES_DENSIDADE: readonly ClasseCor[] = [
  { desde: 0, cor: '#f2f0f7', rotulo: 'menos de 10' },
  { desde: 10, cor: '#dadaeb', rotulo: '10 a 500' },
  { desde: 500, cor: '#bcbddc', rotulo: '500 a 2 000' },
  { desde: 2000, cor: '#9e9ac8', rotulo: '2 000 a 5 000' },
  { desde: 5000, cor: '#756bb1', rotulo: '5 000 a 15 000' },
  { desde: 15000, cor: '#54278f', rotulo: '15 000 ou mais' },
];

/** Escala de uma camada pela sua unidade: % do hexágono (m²) ou densidade (outras). */
export function classesPara(unidade: string): readonly ClasseCor[] {
  return unidade === 'm2' ? CLASSES_PERCENTAGEM : CLASSES_DENSIDADE;
}

export const COR_SEM_DADOS = '#cfcfcf';

/** Nome da propriedade do tile com o valor de um ano (definido pela API). */
export function propriedadeDoAno(ano: number): string {
  return `a${ano}`;
}

/** Expressão MapLibre que pinta cada hexágono pela classe do seu valor no `ano`. */
export function expressaoCor(
  ano: number,
  classes: readonly ClasseCor[] = CLASSES_PERCENTAGEM,
): ExpressionSpecification {
  const [primeira, ...resto] = classes;
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

/** Classe de um valor (para testes e para o painel). */
export function classeDe(
  valor: number | null | undefined,
  classes: readonly ClasseCor[] = CLASSES_PERCENTAGEM,
): ClasseCor | null {
  if (valor === null || valor === undefined || valor < 0) return null;
  let atual = classes[0];
  for (const classe of classes) if (valor >= classe.desde) atual = classe;
  return atual;
}
