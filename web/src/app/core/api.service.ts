import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AreaEstudo, Camada, RespostaApi, ResumoGrelha } from './api.types';

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

  /** Modelo de URL dos tiles da grelha, no formato que o MapLibre espera. */
  urlTilesGrelha(): string {
    return `${this.absoluto(this.baseUrl)}/grelha/tiles/{z}/{x}/{y}`;
  }

  private obter<T>(caminho: string): Observable<T> {
    return this.http.get<RespostaApi<T>>(`${this.baseUrl}/${caminho}`).pipe(map((r) => r.data));
  }

  /** O MapLibre pede os tiles num worker, por isso precisa de um URL absoluto. */
  private absoluto(url: string): string {
    return new URL(url, globalThis.location?.origin ?? 'http://localhost').href.replace(/\/$/, '');
  }
}
