import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ANOS, ANO_FINAL, ANO_INICIAL, PASSO_ANOS, ULTIMO_ANO_OBSERVADO } from '../core/anos';
import { AreaEstudo, Camada, ResumoGrelha } from '../core/api.types';

@Component({
  selector: 'app-painel',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './painel.component.html',
  host: { class: 'block' },
})
export class PainelComponent {
  readonly areaEstudo = input<AreaEstudo | null>(null);
  readonly grelha = input<ResumoGrelha | null>(null);
  readonly camadas = input<Camada[]>([]);
  readonly zoom = input(0);
  readonly erro = input<string | null>(null);

  readonly ano = model(ULTIMO_ANO_OBSERVADO);
  readonly mostrarGrelha = model(true);

  readonly anoInicial = ANO_INICIAL;
  readonly anoFinal = ANO_FINAL;
  readonly passoAnos = PASSO_ANOS;
  readonly anos = ANOS;

  readonly projecao = computed(() => this.ano() > ULTIMO_ANO_OBSERVADO);
  readonly grelhaVisivelNoZoom = computed(() => {
    const grelha = this.grelha();
    return !grelha || this.zoom() >= grelha.zoomMinimo;
  });
  readonly algumaCamadaDisponivel = computed(() => this.camadas().some((c) => c.disponivel));

  mudarAno(evento: Event): void {
    this.ano.set(Number((evento.target as HTMLInputElement).value));
  }

  mudarGrelha(evento: Event): void {
    this.mostrarGrelha.set((evento.target as HTMLInputElement).checked);
  }
}
