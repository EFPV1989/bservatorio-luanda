/** Anos do deslizador: os anos da série GHSL (de 5 em 5, de 1975 a 2030). */
export const ANO_INICIAL = 1975;
export const ANO_FINAL = 2030;
export const PASSO_ANOS = 5;

/** Último ano observado; a partir daqui os valores são projeções. */
export const ULTIMO_ANO_OBSERVADO = 2020;

export const ANOS: readonly number[] = Array.from(
  { length: (ANO_FINAL - ANO_INICIAL) / PASSO_ANOS + 1 },
  (_, i) => ANO_INICIAL + i * PASSO_ANOS,
);
