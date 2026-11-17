import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { ResumoGrelha } from './api.types';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('desembrulha o envelope { success, data, meta } da API', () => {
    const resumo: ResumoGrelha = {
      ladoM: 500,
      hexagonos: 32711,
      areaCobertaKm2: 20958,
      bbox: [12.94, -10.06, 14.11, -8.54],
      zoomMinimo: 10,
    };
    let recebido: ResumoGrelha | undefined;
    api.grelha().subscribe((r) => (recebido = r));

    http
      .expectOne(`${api.baseUrl}/grelha`)
      .flush({ success: true, data: resumo, meta: { requestId: 'req_teste' } });

    expect(recebido).toEqual(resumo);
  });

  it('pede o catálogo de camadas e a área de estudo nos caminhos certos', () => {
    api.camadas().subscribe();
    api.areaEstudo().subscribe();
    http.expectOne(`${api.baseUrl}/camadas`).flush({ success: true, data: [], meta: {} });
    http.expectOne(`${api.baseUrl}/area-estudo`).flush({ success: true, data: {}, meta: {} });
  });

  it('dá ao MapLibre um URL absoluto de tiles com {z}/{x}/{y}', () => {
    const url = api.urlTilesGrelha();
    expect(url).toMatch(/^https?:\/\//);
    expect(url.endsWith('/grelha/tiles/{z}/{x}/{y}')).toBeTrue();
  });
});
