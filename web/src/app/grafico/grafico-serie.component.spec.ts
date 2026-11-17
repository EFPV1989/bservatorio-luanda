import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt-PT';
import { GraficoSerieComponent } from './grafico-serie.component';

registerLocaleData(localePt, 'pt');

describe('GraficoSerieComponent', () => {
  function criar(pontos: { ano: number; valor: number; projecao: boolean }[], anoAtual: number | null) {
    TestBed.configureTestingModule({
      imports: [GraficoSerieComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'pt' }],
    });
    const fixture = TestBed.createComponent(GraficoSerieComponent);
    fixture.componentRef.setInput('pontos', pontos);
    fixture.componentRef.setInput('anoAtual', anoAtual);
    fixture.componentRef.setInput('titulo', 'Teste');
    fixture.detectChanges();
    return fixture;
  }

  it('desenha observado a cheio e projeção a tracejado, a partir do último observado', () => {
    const fixture = criar(
      [
        { ano: 2010, valor: 1, projecao: false },
        { ano: 2020, valor: 2, projecao: false },
        { ano: 2030, valor: 3, projecao: true },
      ],
      2020,
    );
    const [observado, projecao] = Array.from(fixture.nativeElement.querySelectorAll('path')) as SVGPathElement[];
    expect(observado.getAttribute('d')?.match(/[ML]/g)?.length).toBe(2);
    expect(projecao.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(projecao.getAttribute('d')?.match(/[ML]/g)?.length).toBe(2); // 2020 → 2030
    expect(fixture.nativeElement.querySelectorAll('circle').length).toBe(3);
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain('2030');
  });

  it('valores maiores ficam mais acima e o eixo começa em zero', () => {
    const fixture = criar(
      [
        { ano: 2000, valor: 0, projecao: false },
        { ano: 2020, valor: 40, projecao: false },
      ],
      null,
    );
    const c = fixture.componentInstance;
    expect(c.y(40)).toBeLessThan(c.y(0));
    expect(c.marcasY()[0]).toBe(0);
    expect(c.marcasY()[2]).toBeGreaterThanOrEqual(40);
  });

  it('não sobrepõe rótulos do eixo junto às pontas', () => {
    const anos = [1975, 1980, 1985, 1990, 2000, 2010, 2020, 2025, 2030];
    const fixture = criar(anos.map((ano) => ({ ano, valor: 1, projecao: ano > 2020 })), null);
    const rotulos = Array.from(fixture.nativeElement.querySelectorAll('text') as NodeListOf<SVGTextElement>)
      .map((t) => t.textContent?.trim())
      .filter((t) => /^\d{4}$/.test(t ?? ''));
    expect(rotulos).toEqual(['1975', '1990', '2000', '2010', '2020', '2030']);
  });

  it('em pessoas, o eixo usa milhões e a descrição diz "pessoas"', () => {
    TestBed.configureTestingModule({ imports: [GraficoSerieComponent], providers: [{ provide: LOCALE_ID, useValue: 'pt' }] });
    const fixture = TestBed.createComponent(GraficoSerieComponent);
    fixture.componentRef.setInput('pontos', [
      { ano: 2015, valor: 7_000_000, projecao: false },
      { ano: 2030, valor: 11_000_000, projecao: true },
    ]);
    fixture.componentRef.setInput('formato', 'pessoas');
    fixture.componentRef.setInput('titulo', 'População');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.rotuloY(10_000_000)).toBe('10 mi');
    expect(c.rotuloY(500_000)).toBe('500 mil');
    expect(c.marcasY()[2]).toBeGreaterThanOrEqual(11_000_000);
    expect(fixture.nativeElement.querySelector('svg').getAttribute('aria-label')).toContain('pessoas');
  });
});

