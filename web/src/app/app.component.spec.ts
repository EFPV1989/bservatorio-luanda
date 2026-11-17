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

registerLocaleData(localePt, 'pt');

/** O mapa real precisa de WebGL; nos testes usamos um substituto com as mesmas entradas. */
@Component({ selector: 'app-mapa', standalone: true, template: '' })
class MapaFalsoComponent {
  readonly estiloBase = input<string>();
  readonly urlTilesGrelha = input<string>();
  readonly areaEstudo = input<unknown>();
  readonly grelha = input<unknown>();
  readonly mostrarGrelha = input<boolean>();
  readonly zoomMudou = output<number>();
}

function criar(api: Partial<ApiService>) {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [
      { provide: ApiService, useValue: { urlTilesGrelha: () => 'http://x/{z}/{x}/{y}', ...api } },
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

describe('AppComponent', () => {
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
