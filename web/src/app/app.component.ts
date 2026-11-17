import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';
import { ApiService } from './core/api.service';
import { AreaEstudo, Camada, PontoSerie, ResumoGrelha } from './core/api.types';
import { ULTIMO_ANO_OBSERVADO } from './core/anos';
import { classesPara } from './core/escala';
import { MapaComponent } from './mapa/mapa.component';
import { HexagonoSelecionado, PainelComponent } from './painel/painel.component';

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

  readonly areaEstudo = signal<AreaEstudo | null>(null);
  readonly grelha = signal<ResumoGrelha | null>(null);
  readonly camadas = signal<Camada[]>([]);
  readonly erro = signal<string | null>(null);

  readonly ano = signal(ULTIMO_ANO_OBSERVADO);
  readonly mostrarGrelha = signal(true);
  readonly zoom = signal(0);

  readonly idCamadaAtiva = signal<string | null>(null);
  readonly camadaAtiva = computed(
    () => this.camadas().find((c) => c.id === this.idCamadaAtiva() && c.disponivel) ?? null,
  );
  readonly serie = signal<PontoSerie[] | null>(null);
  readonly hexagono = signal<HexagonoSelecionado | null>(null);

  readonly urlTilesGrelha = computed(() => this.api.urlTilesGrelha(this.camadaAtiva()?.id));
  readonly classes = computed(() => {
    const camada = this.camadaAtiva();
    return camada ? classesPara(camada.unidade) : null;
  });

  private pedidoSerie?: Subscription;
  private pedidoHexagono?: Subscription;

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
      .subscribe({
        next: (camadas) => {
          this.camadas.set(camadas);
          // Por omissão, mostra a primeira camada com dados.
          this.escolherCamada(camadas.find((c) => c.disponivel)?.id ?? null);
        },
        error: aoFalhar,
      });
  }

  escolherCamada(id: string | null): void {
    this.idCamadaAtiva.set(id);
    this.serie.set(null);
    this.fecharHexagono();
    this.pedidoSerie?.unsubscribe();
    if (!id) return;
    this.pedidoSerie = this.api
      .serie(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (s) => this.serie.set(s), error: (e) => this.erro.set(this.mensagemDeErro(e)) });
  }

  selecionarHexagono(id: string | null): void {
    const camada = this.camadaAtiva();
    if (!id || !camada) {
      this.fecharHexagono();
      return;
    }
    this.hexagono.set({ id, pontos: null });
    this.pedidoHexagono?.unsubscribe();
    this.pedidoHexagono = this.api
      .hexagono(camada.id, id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pontos) => this.hexagono.set({ id, pontos }),
        // Um hexágono sem valores (ex.: só mar) não é um erro da página.
        error: () => this.hexagono.set({ id, pontos: [] }),
      });
  }

  fecharHexagono(): void {
    this.pedidoHexagono?.unsubscribe();
    this.hexagono.set(null);
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
