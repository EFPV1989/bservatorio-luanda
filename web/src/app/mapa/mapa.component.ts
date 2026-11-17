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
import maplibregl, {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapaMapLibre,
  StyleSpecification,
  VectorTileSource,
} from 'maplibre-gl';
import { AreaEstudo, ResumoGrelha } from '../core/api.types';
import { expressaoCor } from '../core/escala';

/** Enquadramento inicial: Luanda num zoom em que a grelha já se vê e a cidade cabe no ecrã. */
const CENTRO_LUANDA: [number, number] = [13.28, -8.9];
const ZOOM_INICIAL = 10;

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
  selecionado: '#1c2b36',
};

const CAMADAS_GRELHA = ['grelha-preenchimento', 'grelha-linhas', 'grelha-selecionado'];

@Component({
  selector: 'app-mapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #contentor class="h-full w-full" role="region" aria-label="Mapa de Luanda"></div>`,
  host: { class: 'block h-full w-full' },
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  readonly estiloBase = input.required<string>();
  /** URL dos tiles da grelha; muda quando muda a camada pedida. */
  readonly urlTilesGrelha = input.required<string>();
  readonly areaEstudo = input<AreaEstudo | null>(null);
  readonly grelha = input<ResumoGrelha | null>(null);
  readonly mostrarGrelha = input(true);
  /** Pintar os hexágonos pela percentagem do ano (quando há uma camada de área ativa). */
  readonly colorir = input(false);
  readonly ano = input(2020);
  readonly hexagonoSelecionado = input<string | null>(null);

  /** Zoom atual, para o painel saber se a grelha já é visível. */
  readonly zoomMudou = output<number>();
  /** Id do hexágono em que se clicou (ou `null` ao clicar fora da grelha). */
  readonly hexagonoClicado = output<string | null>();

  private readonly contentor = viewChild.required<ElementRef<HTMLDivElement>>('contentor');
  private mapa?: MapaMapLibre;
  private carregado = false;
  private usouReserva = false;

  constructor() {
    // Cada efeito reage às suas entradas e só atua depois de o estilo carregar.
    effect(() => {
      const area = this.areaEstudo();
      if (this.carregado && area) this.desenharArea(area);
    });
    effect(() => {
      const grelha = this.grelha();
      if (this.carregado && grelha) this.desenharGrelha(grelha);
    });
    effect(() => {
      const url = this.urlTilesGrelha();
      const fonte = this.carregado ? (this.mapa?.getSource('grelha') as VectorTileSource | undefined) : undefined;
      if (fonte && fonte.tiles?.[0] !== url) fonte.setTiles([url]);
    });
    effect(() => {
      const visivel = this.mostrarGrelha();
      if (this.carregado) this.definirVisibilidadeGrelha(visivel);
    });
    effect(() => {
      const colorir = this.colorir();
      const ano = this.ano();
      if (this.carregado) this.pintar(colorir, ano);
    });
    effect(() => {
      const id = this.hexagonoSelecionado();
      if (this.carregado && this.mapa?.getLayer('grelha-selecionado')) {
        this.mapa.setFilter('grelha-selecionado', this.filtroSelecionado(id));
      }
    });
  }

  ngAfterViewInit(): void {
    const mapa = new maplibregl.Map({
      container: this.contentor().nativeElement,
      style: this.estiloBase(),
      center: CENTRO_LUANDA,
      zoom: ZOOM_INICIAL,
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
    mapa.on('click', (evento) => {
      const alvo = mapa.getLayer('grelha-preenchimento')
        ? mapa.queryRenderedFeatures(evento.point, { layers: ['grelha-preenchimento'] })[0]
        : undefined;
      const id = alvo?.properties?.['id'];
      this.hexagonoClicado.emit(typeof id === 'string' ? id : null);
    });
    mapa.on('mouseenter', 'grelha-preenchimento', () => (mapa.getCanvas().style.cursor = 'pointer'));
    mapa.on('mouseleave', 'grelha-preenchimento', () => (mapa.getCanvas().style.cursor = ''));
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
    if (mapa.getSource('grelha')) return;

    mapa.addSource('grelha', {
      type: 'vector',
      tiles: [this.urlTilesGrelha()],
      minzoom: grelha.zoomMinimo,
      maxzoom: 14, // acima disto o MapLibre amplia os tiles do zoom 14
      bounds: grelha.bbox,
    });
    // Por baixo do contorno da área de estudo, para o contorno ficar visível.
    const antes = mapa.getLayer('area-estudo-contorno') ? 'area-estudo-contorno' : undefined;
    mapa.addLayer(
      {
        id: 'grelha-preenchimento',
        type: 'fill',
        source: 'grelha',
        'source-layer': 'grelha',
        paint: { 'fill-color': CORES.grelhaPreenchimento, 'fill-opacity': 0.15 },
      },
      antes,
    );
    mapa.addLayer(
      {
        id: 'grelha-linhas',
        type: 'line',
        source: 'grelha',
        'source-layer': 'grelha',
        paint: { 'line-color': CORES.grelhaLinha, 'line-width': 0.6, 'line-opacity': 0.7 },
      },
      antes,
    );
    mapa.addLayer({
      id: 'grelha-selecionado',
      type: 'line',
      source: 'grelha',
      'source-layer': 'grelha',
      filter: this.filtroSelecionado(this.hexagonoSelecionado()),
      paint: { 'line-color': CORES.selecionado, 'line-width': 3 },
    });
    this.definirVisibilidadeGrelha(this.mostrarGrelha());
    this.pintar(this.colorir(), this.ano());
  }

  /** Cor por percentagem do ano (camada ativa) ou o tom neutro da grelha. */
  private pintar(colorir: boolean, ano: number): void {
    const mapa = this.mapa!;
    if (!mapa.getLayer('grelha-preenchimento')) return;
    mapa.setPaintProperty(
      'grelha-preenchimento',
      'fill-color',
      colorir ? expressaoCor(ano) : CORES.grelhaPreenchimento,
    );
    mapa.setPaintProperty('grelha-preenchimento', 'fill-opacity', colorir ? 0.85 : 0.15);
    // Com cores, as linhas da grelha ficam discretas para não esconderem o padrão.
    mapa.setPaintProperty('grelha-linhas', 'line-opacity', colorir ? 0.15 : 0.7);
  }

  private filtroSelecionado(id: string | null): ExpressionSpecification {
    return ['==', ['get', 'id'], id ?? ''];
  }

  private definirVisibilidadeGrelha(visivel: boolean): void {
    const mapa = this.mapa!;
    for (const id of CAMADAS_GRELHA) {
      if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', visivel ? 'visible' : 'none');
    }
  }
}
