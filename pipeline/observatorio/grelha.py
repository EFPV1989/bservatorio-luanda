"""Geração da grelha hexagonal de análise.

A grelha é construída num sistema de coordenadas métrico (UTM 33S, EPSG:32733),
que cobre Luanda, e convertida para WGS84 (EPSG:4326) no fim.

Os hexágonos têm o vértice para cima ("pointy-top") e são indexados a partir da
origem fixa do sistema UTM. Assim, o identificador de cada hexágono não muda se
a área de estudo mudar: o mesmo sítio tem sempre o mesmo id, o que permite
juntar dados de anos diferentes sem ambiguidade.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import geopandas as gpd
from shapely.geometry import Polygon
from shapely.prepared import prep

CRS_METRICO = "EPSG:32733"  # UTM zona 33 Sul
CRS_SAIDA = "EPSG:4326"


@dataclass(frozen=True)
class Geometria:
    """Medidas de um hexágono regular com vértice para cima e lado `lado` (m)."""

    lado: float

    @property
    def largura(self) -> float:
        return math.sqrt(3) * self.lado

    @property
    def passo_vertical(self) -> float:
        return 1.5 * self.lado

    @property
    def area_m2(self) -> float:
        return 3 * math.sqrt(3) / 2 * self.lado**2

    def centro(self, linha: int, coluna: int) -> tuple[float, float]:
        """Centro do hexágono (linha, coluna); linhas ímpares deslocadas meia largura."""
        x = coluna * self.largura + (self.largura / 2 if linha % 2 else 0.0)
        y = linha * self.passo_vertical
        return x, y

    def poligono(self, linha: int, coluna: int) -> Polygon:
        cx, cy = self.centro(linha, coluna)
        vertices = []
        for i in range(6):
            angulo = math.radians(60 * i + 30)  # 30° → vértice para cima
            # Arredondar ao milímetro: vizinhos calculam o vértice partilhado a
            # partir de centros diferentes, e sem isto ficariam frestas mínimas.
            vertices.append(
                (
                    round(cx + self.lado * math.cos(angulo), 3),
                    round(cy + self.lado * math.sin(angulo), 3),
                )
            )
        return Polygon(vertices)


def identificador(lado: int, linha: int, coluna: int) -> str:
    """Id estável e legível, por exemplo 'h500_r-19870_c1035'."""
    return f"h{lado}_r{linha}_c{coluna}"


def gerar_grelha(area: gpd.GeoDataFrame, lado: int = 500) -> gpd.GeoDataFrame:
    """Gera os hexágonos que tocam a área de estudo.

    Devolve um GeoDataFrame em WGS84 com as colunas:
    id, linha, coluna, area_km2 (área do hexágono inteiro) e
    fracao_na_area (parte do hexágono dentro da área de estudo, de 0 a 1).
    """
    if area.crs is None:
        raise ValueError("A área de estudo não tem sistema de coordenadas definido.")
    if lado <= 0:
        raise ValueError("O lado do hexágono tem de ser positivo.")

    area_m = area.to_crs(CRS_METRICO)
    forma = area_m.union_all()
    if forma.is_empty:
        raise ValueError("A área de estudo está vazia.")
    forma_preparada = prep(forma)

    geo = Geometria(lado)
    minx, miny, maxx, maxy = forma.bounds
    linha_min = math.floor(miny / geo.passo_vertical) - 1
    linha_max = math.ceil(maxy / geo.passo_vertical) + 1
    coluna_min = math.floor(minx / geo.largura) - 1
    coluna_max = math.ceil(maxx / geo.largura) + 1

    registos = []
    for linha in range(linha_min, linha_max + 1):
        for coluna in range(coluna_min, coluna_max + 1):
            hexagono = geo.poligono(linha, coluna)
            if not forma_preparada.intersects(hexagono):
                continue
            if forma_preparada.contains(hexagono):
                fracao = 1.0
            else:
                fracao = forma.intersection(hexagono).area / geo.area_m2
                if fracao <= 0:
                    continue  # só toca a fronteira, sem área em comum
            registos.append(
                {
                    "id": identificador(lado, linha, coluna),
                    "linha": linha,
                    "coluna": coluna,
                    "area_km2": round(geo.area_m2 / 1e6, 6),
                    "fracao_na_area": round(min(fracao, 1.0), 6),
                    "geometry": hexagono,
                }
            )

    grelha = gpd.GeoDataFrame(registos, geometry="geometry", crs=CRS_METRICO)
    return grelha.to_crs(CRS_SAIDA)
