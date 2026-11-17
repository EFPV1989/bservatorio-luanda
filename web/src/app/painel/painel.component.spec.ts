import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt-PT';
import { PainelComponent } from './painel.component';
import { AreaEstudo, Camada, ResumoGrelha } from '../core/api.types';

registerLocaleData(localePt, 'pt');

const AREA_PROVISORIA: AreaEstudo = {
  type: 'Feature',
  geometry: { type: 'MultiPolygon', coordinates: [] },
  properties: { nome: 'Teste', fonte: 'teste', provisoria: true, areaKm2: 100, carregadaEm: '2026-11-17T00:00:00Z' },
};

const GRELHA: ResumoGrelha = {
  ladoM: 500,
  hexagonos: 32711,
  areaCobertaKm2: 20958,
  bbox: [12.94, -10.06, 14.11, -8.54],
  zoomMinimo: 10,
};

const CAMADA: Camada = {
  id: 'superficie-construida',
  nome: 'Superfície construída',
  descricao: 'Parte de cada hexágono coberta por construção.',
  fonte: { nome: 'GHSL', url: 'https://example.org', licenca: 'CC BY 4.0' },
  anos: { inicio: 1975, fim: 2030, ultimoObservado: 2020, carregados: [] },
  resolucao: '100 m',
  unidade: 'm2',
  notas: [],
  disponivel: false,
};

const CAMADA_COM_DADOS: Camada = {
  ...CAMADA,
  anos: { ...CAMADA.anos, carregados: [1975, 2020, 2030] },
  disponivel: true,
};

describe('PainelComponent', () => {
  let fixture: ComponentFixture<PainelComponent>;
  let el: HTMLElement;

  const q = (seletor: string) => el.querySelector(seletor);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PainelComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'pt' }],
    }).compileComponents();
    fixture = TestBed.createComponent(PainelComponent);
    el = fixture.nativeElement;
  });

  it('avisa quando a área de estudo é provisória', () => {
    fixture.componentRef.setInput('areaEstudo', AREA_PROVISORIA);
    fixture.detectChanges();
    expect(q('[data-testid="aviso-provisorio"]')).not.toBeNull();

    fixture.componentRef.setInput('areaEstudo', {
      ...AREA_PROVISORIA,
      properties: { ...AREA_PROVISORIA.properties, provisoria: false },
    });
    fixture.detectChanges();
    expect(q('[data-testid="aviso-provisorio"]')).toBeNull();
  });

  it('o deslizador muda o ano e assinala os anos projetados', () => {
    fixture.detectChanges();
    expect(q('[data-testid="ano-atual"]')?.textContent?.trim()).toBe('2020');
    expect(q('[data-testid="nota-projecao"]')).toBeNull();

    const deslizador = q('input[type="range"]') as HTMLInputElement;
    expect(deslizador.min).toBe('1975');
    expect(deslizador.max).toBe('2030');
    expect(deslizador.step).toBe('5');

    deslizador.value = '2030';
    deslizador.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.ano()).toBe(2030);
    expect(q('[data-testid="ano-atual"]')?.textContent?.trim()).toBe('2030');
    expect(q('[data-testid="nota-projecao"]')).not.toBeNull();
  });

  it('resume a grelha e sugere aproximar quando o zoom é baixo', () => {
    fixture.componentRef.setInput('grelha', GRELHA);
    fixture.componentRef.setInput('zoom', 8);
    fixture.detectChanges();
    expect(q('[data-testid="resumo-grelha"]')?.textContent).toContain('500 m');
    expect(q('[data-testid="dica-zoom"]')).not.toBeNull();

    fixture.componentRef.setInput('zoom', 11);
    fixture.detectChanges();
    expect(q('[data-testid="dica-zoom"]')).toBeNull();
  });

  it('esconder a grelha atualiza o modelo', () => {
    fixture.detectChanges();
    const caixa = q('input[type="checkbox"]') as HTMLInputElement;
    caixa.checked = false;
    caixa.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.mostrarGrelha()).toBeFalse();
  });

  it('lista as camadas com fonte, licença e o estado "Em breve"', () => {
    fixture.componentRef.setInput('camadas', [CAMADA]);
    fixture.detectChanges();
    const item = q('[data-camada="superficie-construida"]');
    expect(item?.textContent).toContain('Superfície construída');
    expect(item?.textContent).toContain('CC BY 4.0');
    expect(item?.textContent).toContain('Em breve');
    expect(item?.querySelector('a')?.getAttribute('rel')).toBe('noopener');
  });

  it('com uma camada ativa mostra o valor do ano, o gráfico e a legenda', () => {
    fixture.componentRef.setInput('camadas', [CAMADA_COM_DADOS]);
    fixture.componentRef.setInput('camadaAtiva', CAMADA_COM_DADOS);
    fixture.componentRef.setInput('serie', [
      { ano: 1975, total: 50e6, percentagem: 0.25, projecao: false },
      { ano: 2020, total: 400e6, percentagem: 2.03, projecao: false },
      { ano: 2030, total: 500e6, percentagem: 2.53, projecao: true },
    ]);
    fixture.detectChanges();
    expect(q('[data-testid="valor-ano"]')?.textContent).toContain('400 km²');
    expect(q('[data-testid="valor-ano"]')?.textContent).toContain('2,0%');
    expect(q('app-grafico-serie')).not.toBeNull();
    expect(q('[data-testid="legenda"]')?.querySelectorAll('li').length).toBe(7);
    // A camada disponível tem caixa para ligar/desligar, e está ligada.
    const caixa = q('[data-camada="superficie-construida"] input[type="checkbox"]') as HTMLInputElement;
    expect(caixa.checked).toBeTrue();
  });

  it('desligar a camada pede "nenhuma camada"', () => {
    fixture.componentRef.setInput('camadas', [CAMADA_COM_DADOS]);
    fixture.componentRef.setInput('camadaAtiva', CAMADA_COM_DADOS);
    fixture.detectChanges();
    let escolhida: string | null | undefined;
    fixture.componentInstance.camadaEscolhida.subscribe((v) => (escolhida = v));
    const caixa = q('[data-camada="superficie-construida"] input[type="checkbox"]') as HTMLInputElement;
    caixa.checked = false;
    caixa.dispatchEvent(new Event('change'));
    expect(escolhida).toBeNull();
  });

  it('avisa quando a camada não tem dados para o ano escolhido', () => {
    fixture.componentRef.setInput('camadaAtiva', CAMADA_COM_DADOS);
    fixture.componentInstance.ano.set(1990);
    fixture.detectChanges();
    expect(q('[data-testid="nota-sem-dados"]')).not.toBeNull();
  });

  it('mostra o hexágono selecionado com o valor do ano', () => {
    fixture.componentRef.setInput('camadaAtiva', CAMADA_COM_DADOS);
    fixture.componentRef.setInput('hexagono', {
      id: 'h500_r1_c1',
      pontos: [{ ano: 2020, valor: 324759, percentagem: 50, projecao: false }],
    });
    fixture.detectChanges();
    expect(q('[data-testid="valor-hexagono"]')?.textContent).toContain('50%');
    expect(q('[data-testid="valor-hexagono"]')?.textContent).toContain('32,5 ha');
  });

  it('mostra as limitações da camada ativa', () => {
    const comNotas = { ...CAMADA_COM_DADOS, notas: ['A série só regista construção nova: não mostra demolições.'] };
    fixture.componentRef.setInput('camadaAtiva', comNotas);
    fixture.componentRef.setInput('serie', [{ ano: 2020, total: 1e8, percentagem: 1, projecao: false }]);
    fixture.detectChanges();
    expect(q('[data-testid="notas-camada"]')?.textContent).toContain('não mostra demolições');
    expect(el.textContent).toContain('estimado a partir de imagens de satélite');
    expect(el.textContent).not.toContain('Linha cheia: observado');
  });
});
