import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt-PT';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { ApiService } from './core/api.service';
import { MapaComponent } from './mapa/mapa.component';
import { Camada } from './core/api.types';

registerLocaleData(localePt, 'pt');

/** O mapa real precisa de WebGL; nos testes usamos um substituto com as mesmas entradas. */
@Component({ selector: 'app-mapa', standalone: true, template: '' })
class MapaFalsoComponent {
  readonly estiloBase = input<string>();
  readonly urlTilesGrelha = input<string>();
  readonly areaEstudo = input<unknown>();
  readonly grelha = input<unknown>();
  readonly mostrarGrelha = input<boolean>();
  readonly colorir = input<boolean>();
  readonly ano = input<number>();
  readonly hexagonoSelecionado = input<string | null>();
  readonly zoomMudou = output<number>();
  readonly hexagonoClicado = output<string | null>();
}

function criar(api: Partial<ApiService>) {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      {
        provide: ApiService,
        useValue: {
          urlTilesGrelha: (camada?: string | null) => `http://x/{z}/{x}/{y}${camada ? '?camada=' + camada : ''}`,
          ...api,
        },
      },
      { provide: LOCALE_ID, useValue: 'pt' },
    ],
  });
  TestBed.overrideComponent(AppComponent, {
    remove: { imports: [MapaComponent] },
    add: { imports: [MapaFalsoComponent] },
  });
  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();
  return fixture;
}

const CAMADA_GHSL: Camada = {
  id: 'superficie-construida',
  nome: 'Superfície construída',
  descricao: 'd',
  fonte: { nome: 'GHSL', url: 'https://example.org', licenca: 'CC BY 4.0' },
  anos: { inicio: 1975, fim: 2030, ultimoObservado: 2020, carregados: [1975, 2020, 2030] },
  resolucao: '100 m',
  unidade: 'm2',
  notas: [],
  disponivel: true,
};

describe('AppComponent', () => {
  it('ativa a primeira camada com dados, pede a série e os tiles dessa camada', () => {
    const serie = jasmine.createSpy('serie').and.returnValue(of([{ ano: 2020, total: 1e8, percentagem: 5, projecao: false }]));
    const fixture = criar({
      areaEstudo: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      grelha: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      camadas: () => of([{ ...CAMADA_GHSL, id: 'edificios', disponivel: false }, CAMADA_GHSL]),
      serie,
    });
    const app = fixture.componentInstance;
    expect(app.camadaAtiva()?.id).toBe('superficie-construida');
    expect(serie).toHaveBeenCalledWith('superficie-construida');
    expect(app.serie()?.length).toBe(1);
    expect(app.urlTilesGrelha()).toContain('?camada=superficie-construida');
    expect(app.colorir()).toBeTrue();

    app.escolherCamada(null);
    expect(app.camadaAtiva()).toBeNull();
    expect(app.urlTilesGrelha()).not.toContain('camada');
    expect(app.colorir()).toBeFalse();
  });

  it('clicar num hexágono pede a sua série; clicar fora fecha', () => {
    const hexagono = jasmine.createSpy('hexagono').and.returnValue(of([{ ano: 2020, valor: 1000, percentagem: 10, projecao: false }]));
    const fixture = criar({
      areaEstudo: () => of(),
      grelha: () => of(),
      camadas: () => of([CAMADA_GHSL]),
      serie: () => of([]),
      hexagono,
    });
    const app = fixture.componentInstance;
    app.selecionarHexagono('h500_r1_c1');
    expect(hexagono).toHaveBeenCalledWith('superficie-construida', 'h500_r1_c1');
    expect(app.hexagono()?.pontos?.length).toBe(1);
    app.selecionarHexagono(null);
    expect(app.hexagono()).toBeNull();
  });

  it('carrega a grelha e as camadas da API', () => {
    const fixture = criar({
      areaEstudo: () => throwError(() => new HttpErrorResponse({ status: 404 })),
      grelha: () =>
        of({ ladoM: 500, hexagonos: 10, areaCobertaKm2: 6, bbox: [0, 0, 1, 1], zoomMinimo: 10 }),
      camadas: () => of([]),
    });
    expect(fixture.componentInstance.grelha()?.ladoM).toBe(500);
  });

  it('mostra uma mensagem clara quando a API não responde', () => {
    const semRede = () => throwError(() => new HttpErrorResponse({ status: 0 }));
    const fixture = criar({ areaEstudo: semRede, grelha: semRede, camadas: semRede });
    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('Não foi possível contactar a API');
  });

  it('mostra a mensagem de erro que a API devolve', () => {
    const erro = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { success: false, error: { code: 'GRELHA_NOT_LOADED', message: 'A grelha de análise ainda não foi carregada.' } },
          }),
      );
    const fixture = criar({ areaEstudo: erro, grelha: erro, camadas: () => of([]) });
    const alerta = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('A grelha de análise ainda não foi carregada.');
  });
});
