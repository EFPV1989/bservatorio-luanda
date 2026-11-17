import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../environments/environment';
import { ApiService } from './core/api.service';
import { AreaEstudo, Camada, ResumoGrelha } from './core/api.types';
import { ULTIMO_ANO_OBSERVADO } from './core/anos';
import { MapaComponent } from './mapa/mapa.component';
import { PainelComponent } from './painel/painel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MapaComponent, PainelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly estiloBase = environment.estiloMapaBase;
  readonly urlTilesGrelha = this.api.urlTilesGrelha();

  readonly areaEstudo = signal<AreaEstudo | null>(null);
  readonly grelha = signal<ResumoGrelha | null>(null);
  readonly camadas = signal<Camada[]>([]);
  readonly erro = signal<string | null>(null);

  readonly ano = signal(ULTIMO_ANO_OBSERVADO);
  readonly mostrarGrelha = signal(true);
  readonly zoom = signal(0);

  ngOnInit(): void {
    const aoFalhar = (erro: unknown) => this.erro.set(this.mensagemDeErro(erro));
    this.api
      .areaEstudo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (a) => this.areaEstudo.set(a), error: aoFalhar });
    this.api
      .grelha()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (g) => this.grelha.set(g), error: aoFalhar });
    this.api
      .camadas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (c) => this.camadas.set(c), error: aoFalhar });
  }

  private mensagemDeErro(erro: unknown): string {
    if (erro instanceof HttpErrorResponse) {
      if (erro.status === 0) return 'Não foi possível contactar a API. Confirme que está a correr.';
      const mensagem = erro.error?.error?.message;
      if (typeof mensagem === 'string') return mensagem;
    }
    return 'Ocorreu um erro ao carregar os dados.';
  }
}
