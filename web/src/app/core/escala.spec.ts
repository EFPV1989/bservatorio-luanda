import { CLASSES_DENSIDADE, CLASSES_PERCENTAGEM, COR_SEM_DADOS, classeDe, classesPara, expressaoCor } from './escala';

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

  it('a densidade tem a sua própria escala, escolhida pela unidade', () => {
    expect(classesPara('m2')).toBe(CLASSES_PERCENTAGEM);
    expect(classesPara('pessoas')).toBe(CLASSES_DENSIDADE);
    expect(classeDe(9, CLASSES_DENSIDADE)?.rotulo).toBe('menos de 10');
    expect(classeDe(20000, CLASSES_DENSIDADE)?.rotulo).toBe('15 000 ou mais');
    const cores = (expressaoCor(2020, CLASSES_DENSIDADE) as unknown[]).slice(3).filter((_, i) => i % 2 === 1);
    expect(cores).toEqual(CLASSES_DENSIDADE.map((c) => c.cor));
  });
});

