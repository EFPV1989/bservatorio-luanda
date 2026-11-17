import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import maplibregl, { GeoJSONSource, Map as MapaMapLibre, StyleSpecification } from 'maplibre-gl';
import { AreaEstudo, ResumoGrelha } from '../core/api.types';

/** Enquadramento inicial: o centro de Luanda, num zoom em que a grelha já se vê. */
const CENTRO_LUANDA: [number, number] = [13.234, -8.839];

/**
 * Estilo de reserva, sem mapa de base: usado se o estilo principal não
 * carregar (servidor em baixo, sem rede externa). Os dados do observatório
 * continuam a aparecer sobre um fundo liso.
 */
const ESTILO_RESERVA: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#f2efe9' } }],
};

const CORES = {
  area: '#1c2b36',
  grelhaLinha: '#c2410c',
  grelhaPreenchimento: '#fed7aa',
};

@Component({
  selector: 'app-mapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #contentor class="h-full w-full" role="region" aria-label="Mapa de Luanda"></div>`,
  host: { class: 'block h-full w-full' },
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  readonly estiloBase = input.required<string>();
  readonly urlTilesGrelha = input.required<string>();
  readonly areaEstudo = input<AreaEstudo | null>(null);
  readonly grelha = input<ResumoGrelha | null>(null);
  readonly mostrarGrelha = input(true);

  /** Zoom atual, para o painel saber se a grelha já é visível. */
  readonly zoomMudou = output<number>();

  private readonly contentor = viewChild.required<ElementRef<HTMLDivElement>>('contentor');
  private mapa?: MapaMapLibre;
  private carregado = false;
  private usouReserva = false;

  constructor() {
    // Cada efeito reage a uma entrada e só atua depois de o estilo carregar.
    effect(() => {
      const area = this.areaEstudo();
      if (this.carregado && area) this.desenharArea(area);
    });
    effect(() => {
      const grelha = this.grelha();
      if (this.carregado && grelha) this.desenharGrelha(grelha);
    });
    effect(() => {
      const visivel = this.mostrarGrelha();
      if (this.carregado) this.definirVisibilidadeGrelha(visivel);
    });
  }

  ngAfterViewInit(): void {
    const mapa = new maplibregl.Map({
      container: this.contentor().nativeElement,
      style: this.estiloBase(),
      center: CENTRO_LUANDA,
      zoom: 11,
      attributionControl: { compact: true },
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapa.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    mapa.on('load', () => {
      this.carregado = true;
      const area = this.areaEstudo();
      const grelha = this.grelha();
      if (area) this.desenharArea(area);
      if (grelha) this.desenharGrelha(grelha);
    });
    // Se o próprio estilo de base não chegar a carregar, troca para o de reserva.
    // (Erros de tiles depois de o estilo carregar não contam.)
    let estiloRecebido = false;
    mapa.once('styledata', () => (estiloRecebido = true));
    mapa.on('error', () => {
      if (!estiloRecebido && !this.usouReserva) {
        this.usouReserva = true;
        mapa.setStyle(ESTILO_RESERVA);
      }
    });
    mapa.on('zoomend', () => this.zoomMudou.emit(mapa.getZoom()));
    this.mapa = mapa;
    // Fora do ciclo de deteção de alterações atual, para o painel saber o zoom inicial.
    queueMicrotask(() => this.zoomMudou.emit(mapa.getZoom()));
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  private desenharArea(area: AreaEstudo): void {
    const mapa = this.mapa!;
    const fonte = mapa.getSource('area-estudo') as GeoJSONSource | undefined;
    if (fonte) {
      fonte.setData(area);
    } else {
      mapa.addSource('area-estudo', { type: 'geojson', data: area });
      mapa.addLayer({
        id: 'area-estudo-contorno',
        type: 'line',
        source: 'area-estudo',
        paint: {
          'line-color': CORES.area,
          'line-width': 2,
          // Tracejado = contorno provisório, ainda não oficial.
          'line-dasharray': area.properties.provisoria ? [3, 2] : [1, 0],
        },
      });
    }
  }

  private desenharGrelha(grelha: ResumoGrelha): void {
    const mapa = this.mapa!;
    if (!mapa.getSource('grelha')) {
      mapa.addSource('grelha', {
        type: 'vector',
        tiles: [this.urlTilesGrelha()],
        minzoom: grelha.zoomMinimo,
        maxzoom: 14, // acima disto o MapLibre amplia os tiles do zoom 14
        bounds: grelha.bbox,
      });
      mapa.addLayer({
        id: 'grelha-preenchimento',
        type: 'fill',
        source: 'grelha',
        'source-layer': 'grelha',
        paint: { 'fill-color': CORES.grelhaPreenchimento, 'fill-opacity': 0.15 },
      });
      mapa.addLayer({
        id: 'grelha-linhas',
        type: 'line',
        source: 'grelha',
        'source-layer': 'grelha',
        paint: { 'line-color': CORES.grelhaLinha, 'line-width': 0.6, 'line-opacity': 0.7 },
      });
      this.definirVisibilidadeGrelha(this.mostrarGrelha());
    }
  }

  private definirVisibilidadeGrelha(visivel: boolean): void {
    const mapa = this.mapa!;
    for (const id of ['grelha-preenchimento', 'grelha-linhas']) {
      if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', visivel ? 'visible' : 'none');
    }
  }
}
