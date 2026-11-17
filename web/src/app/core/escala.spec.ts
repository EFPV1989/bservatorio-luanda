import { CLASSES_PERCENTAGEM, COR_SEM_DADOS, classeDe, expressaoCor } from './escala';

describe('escala de cores', () => {
  it('classifica percentagens nos limites certos', () => {
    expect(classeDe(0)?.rotulo).toBe('menos de 1%');
    expect(classeDe(0.99)?.rotulo).toBe('menos de 1%');
    expect(classeDe(1)?.rotulo).toBe('1 a 10%');
    expect(classeDe(25)?.rotulo).toBe('25 a 50%');
    expect(classeDe(100)?.rotulo).toBe('75% ou mais');
    expect(classeDe(null)).toBeNull();
    expect(classeDe(-1)).toBeNull();
  });

  it('a expressão do mapa usa a propriedade do ano e as mesmas classes da legenda', () => {
    const expressao = expressaoCor(1995) as unknown[];
    expect(expressao[0]).toBe('step');
    expect(expressao[1]).toEqual(['coalesce', ['get', 'a1995'], -1]);
    expect(expressao[2]).toBe(COR_SEM_DADOS);
    const cores = expressao.slice(3).filter((_, i) => i % 2 === 1);
    expect(cores).toEqual(CLASSES_PERCENTAGEM.map((c) => c.cor));
  });
});
