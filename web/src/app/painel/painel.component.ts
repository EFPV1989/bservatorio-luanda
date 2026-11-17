import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ANOS, ANO_FINAL, ANO_INICIAL, PASSO_ANOS, ULTIMO_ANO_OBSERVADO } from '../core/anos';
import { AreaEstudo, Camada, PontoHexagono, PontoSerie, ResumoGrelha } from '../core/api.types';
import { CLASSES_PERCENTAGEM, COR_SEM_DADOS } from '../core/escala';
import { GraficoSerieComponent, PontoGrafico } from '../grafico/grafico-serie.component';

export interface HexagonoSelecionado {
  id: string;
  pontos: PontoHexagono[] | null;
}

@Component({
  selector: 'app-painel',
  standalone: true,
  imports: [DecimalPipe, GraficoSerieComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './painel.component.html',
  host: { class: 'block' },
})
export class PainelComponent {
  readonly areaEstudo = input<AreaEstudo | null>(null);
  readonly grelha = input<ResumoGrelha | null>(null);
  readonly camadas = input<Camada[]>([]);
  readonly camadaAtiva = input<Camada | null>(null);
  readonly serie = input<PontoSerie[] | null>(null);
  readonly hexagono = input<HexagonoSelecionado | null>(null);
  readonly zoom = input(0);
  readonly erro = input<string | null>(null);

  readonly ano = model(ULTIMO_ANO_OBSERVADO);
  readonly mostrarGrelha = model(true);

  /** Pedido para mostrar uma camada no mapa (`null` = nenhuma). */
  readonly camadaEscolhida = output<string | null>();
  readonly fecharHexagono = output<void>();

  readonly anoInicial = ANO_INICIAL;
  readonly anoFinal = ANO_FINAL;
  readonly passoAnos = PASSO_ANOS;
  readonly anos = ANOS;
  readonly classes = CLASSES_PERCENTAGEM;
  readonly corSemDados = COR_SEM_DADOS;

  /** Último ano observado: o da camada ativa, ou o da GHSL por omissão. */
  private readonly ultimoObservado = computed(
    () => this.camadaAtiva()?.anos.ultimoObservado ?? ULTIMO_ANO_OBSERVADO,
  );
  readonly projecao = computed(() => this.ano() > this.ultimoObservado());
  readonly grelhaVisivelNoZoom = computed(() => {
    const grelha = this.grelha();
    return !grelha || this.zoom() >= grelha.zoomMinimo;
  });
  readonly algumaCamadaDisponivel = computed(() => this.camadas().some((c) => c.disponivel));
  readonly anoSemDados = computed(() => {
    const camada = this.camadaAtiva();
    return !!camada && !camada.anos.carregados.includes(this.ano());
  });

  readonly pontoSerieDoAno = computed(() => this.serie()?.find((p) => p.ano === this.ano()) ?? null);

  readonly graficoSerie = computed<PontoGrafico[]>(() =>
    (this.serie() ?? [])
      .filter((p) => p.percentagem !== null)
      .map((p) => ({ ano: p.ano, valor: p.percentagem!, projecao: p.projecao })),
  );

  readonly graficoHexagono = computed<PontoGrafico[]>(() =>
    (this.hexagono()?.pontos ?? [])
      .filter((p) => p.percentagem !== null)
      .map((p) => ({ ano: p.ano, valor: p.percentagem!, projecao: p.projecao })),
  );

  readonly pontoHexagonoDoAno = computed(
    () => this.hexagono()?.pontos?.find((p) => p.ano === this.ano()) ?? null,
  );

  mudarAno(evento: Event): void {
    this.ano.set(Number((evento.target as HTMLInputElement).value));
  }

  mudarGrelha(evento: Event): void {
    this.mostrarGrelha.set((evento.target as HTMLInputElement).checked);
  }

  alternarCamada(camada: Camada, evento: Event): void {
    const ligada = (evento.target as HTMLInputElement).checked;
    this.camadaEscolhida.emit(ligada ? camada.id : null);
  }
}
