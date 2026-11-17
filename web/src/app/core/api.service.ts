import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AreaEstudo, Camada, PontoHexagono, PontoSerie, RespostaApi, ResumoGrelha } from './api.types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  areaEstudo(): Observable<AreaEstudo> {
    return this.obter<AreaEstudo>('area-estudo');
  }

  grelha(): Observable<ResumoGrelha> {
    return this.obter<ResumoGrelha>('grelha');
  }

  camadas(): Observable<Camada[]> {
    return this.obter<Camada[]>('camadas');
  }

  serie(camada: string): Observable<PontoSerie[]> {
    return this.obter<PontoSerie[]>(`camadas/${encodeURIComponent(camada)}/serie`);
  }

  hexagono(camada: string, hexagono: string): Observable<PontoHexagono[]> {
    return this.obter<PontoHexagono[]>(
      `camadas/${encodeURIComponent(camada)}/hexagonos/${encodeURIComponent(hexagono)}`,
    );
  }

  /**
   * Modelo de URL dos tiles da grelha, no formato que o MapLibre espera.
   * Com `camada`, os tiles trazem os valores dessa camada ano a ano.
   */
  urlTilesGrelha(camada?: string | null): string {
    const base = `${this.absoluto(this.baseUrl)}/grelha/tiles/{z}/{x}/{y}`;
    return camada ? `${base}?camada=${encodeURIComponent(camada)}` : base;
  }

  private obter<T>(caminho: string): Observable<T> {
    return this.http.get<RespostaApi<T>>(`${this.baseUrl}/${caminho}`).pipe(map((r) => r.data));
  }

  /** O MapLibre pede os tiles num worker, por isso precisa de um URL absoluto. */
  private absoluto(url: string): string {
    return new URL(url, globalThis.location?.origin ?? 'http://localhost').href.replace(/\/$/, '');
  }
}
