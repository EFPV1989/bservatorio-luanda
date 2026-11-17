import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface PontoGrafico {
  ano: number;
  valor: number;
  projecao: boolean;
}

/** Medidas internas do SVG; o gráfico escala para a largura disponível. */
const L = 320;
const A = 140;
const M = { esq: 34, dir: 8, cima: 10, baixo: 22 };

/**
 * Pequeno gráfico de linha (percentagem por ano). As projeções são desenhadas
 * a tracejado e o ano atual do deslizador fica marcado.
 */
@Component({
  selector: 'app-grafico-serie',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + largura + ' ' + altura"
      class="w-full"
      role="img"
      [attr.aria-label]="descricao()"
    >
      @for (t of marcasY(); track t) {
        <line [attr.x1]="m.esq" [attr.x2]="largura - m.dir" [attr.y1]="y(t)" [attr.y2]="y(t)" stroke="#e3e0d8" />
        <text [attr.x]="m.esq - 4" [attr.y]="y(t) + 3" text-anchor="end" font-size="9" fill="#8a98a3">
          {{ t | number: '1.0-0' : 'pt' }}%
        </text>
      }
      @for (p of pontos(); track p.ano; let primeiro = $first; let ultimo = $last) {
        @if (primeiro || ultimo || mostrarAno(p.ano)) {
          <!-- Os anos das pontas alinham para dentro, para não serem cortados. -->
          <text
            [attr.x]="x(p.ano)"
            [attr.y]="altura - 6"
            [attr.text-anchor]="primeiro ? 'start' : ultimo ? 'end' : 'middle'"
            font-size="9"
            fill="#8a98a3"
          >
            {{ p.ano }}
          </text>
        }
      }
      @if (anoNoGrafico(); as a) {
        <line [attr.x1]="x(a)" [attr.x2]="x(a)" [attr.y1]="m.cima" [attr.y2]="altura - m.baixo" stroke="#1c2b36" stroke-dasharray="2 2" />
      }
      <path [attr.d]="caminhoObservado()" fill="none" stroke="#c2410c" stroke-width="2" />
      <path [attr.d]="caminhoProjecao()" fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="4 3" />
      @for (p of pontos(); track p.ano) {
        <circle
          [attr.cx]="x(p.ano)"
          [attr.cy]="y(p.valor)"
          [attr.r]="p.ano === anoAtual() ? 4 : 2.5"
          [attr.fill]="p.projecao ? '#ffffff' : '#c2410c'"
          stroke="#c2410c"
          stroke-width="1.5"
        />
      }
    </svg>
  `,
})
export class GraficoSerieComponent {
  readonly pontos = input.required<PontoGrafico[]>();
  readonly anoAtual = input<number | null>(null);
  readonly titulo = input('Série');

  readonly largura = L;
  readonly altura = A;
  readonly m = M;

  private readonly anos = computed(() => this.pontos().map((p) => p.ano));
  private readonly maximo = computed(() => {
    const max = Math.max(0, ...this.pontos().map((p) => p.valor));
    // Teto "redondo" acima do máximo, para a linha não colar ao topo.
    const passo = max <= 10 ? 2 : max <= 50 ? 10 : 20;
    return Math.max(passo, Math.ceil((max * 1.1) / passo) * passo);
  });

  readonly marcasY = computed(() => {
    const max = this.maximo();
    return [0, max / 2, max];
  });

  readonly anoNoGrafico = computed(() => {
    const ano = this.anoAtual();
    return ano !== null && this.anos().includes(ano) ? ano : null;
  });

  readonly caminhoObservado = computed(() => this.caminho(this.pontos().filter((p) => !p.projecao)));
  /** A projeção começa no último ponto observado, para a linha não ter falhas. */
  readonly caminhoProjecao = computed(() => {
    const pontos = this.pontos();
    const i = pontos.findIndex((p) => p.projecao);
    return i < 0 ? '' : this.caminho(pontos.slice(Math.max(0, i - 1)));
  });

  readonly descricao = computed(() => {
    const p = this.pontos();
    if (p.length === 0) return `${this.titulo()}: sem dados`;
    const [a, b] = [p[0], p[p.length - 1]];
    return `${this.titulo()}: de ${a.valor.toFixed(1)}% em ${a.ano} para ${b.valor.toFixed(1)}% em ${b.ano}`;
  });

  /** Rótulos de década, sem os que ficariam colados ao primeiro ou ao último ano. */
  mostrarAno(ano: number): boolean {
    const anos = this.anos();
    return ano % 10 === 0 && ano - anos[0] >= 10 && anos[anos.length - 1] - ano >= 10;
  }

  x(ano: number): number {
    const anos = this.anos();
    const [min, max] = [anos[0], anos[anos.length - 1]];
    const largura = L - M.esq - M.dir;
    return max === min ? M.esq + largura / 2 : M.esq + ((ano - min) / (max - min)) * largura;
  }

  y(valor: number): number {
    return A - M.baixo - (valor / this.maximo()) * (A - M.baixo - M.cima);
  }

  private caminho(pontos: PontoGrafico[]): string {
    return pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${this.x(p.ano)} ${this.y(p.valor)}`).join(' ');
  }
}
