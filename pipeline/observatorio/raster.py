"""Soma de rasters por hexágono, comum a todas as fontes (GHSL, WorldPop, …).

Para cada hexágono somamos os valores das células que caem dentro dele, pesando
cada célula pela fração da sua área que está dentro do hexágono (as células nas
bordas contam só em parte). Os hexágonos chegam já recortados à área de estudo,
para que nada fora da área (mar, províncias vizinhas) entre na soma.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import rasterio
from exactextract import exact_extract
from rasterio.coords import BoundingBox


def caminho_raster(caminho: str | Path) -> str:
    """Caminho legível pelo rasterio: o próprio .tif, ou o .tif dentro de um .zip."""
    caminho = Path(caminho).resolve()
    if caminho.suffix.lower() != ".zip":
        return str(caminho)
    with zipfile.ZipFile(caminho) as arquivo:
        tifs = [n for n in arquivo.namelist() if n.lower().endswith(".tif")]
    if len(tifs) != 1:
        raise ValueError(f"{caminho.name} devia ter exatamente um .tif e tem {len(tifs)}.")
    return f"zip://{caminho}!/{tifs[0]}"


def _contem(exterior: BoundingBox, interior: tuple[float, float, float, float]) -> bool:
    xmin, ymin, xmax, ymax = interior
    return (
        exterior.left <= xmin and exterior.bottom <= ymin and exterior.right >= xmax and exterior.top >= ymax
    )


def soma_por_hexagono(raster: str, hexagonos: gpd.GeoDataFrame, *, fonte_nome: str = "raster") -> pd.DataFrame:
    """Soma dos valores do raster por hexágono.

    `hexagonos` tem as colunas `id` e `geometry` (já recortadas à área de estudo).
    Devolve um DataFrame com `id` e `valor`. As células sem dados não contam.
    """
    # O exactextract trata uma coluna chamada "id" como o número da linha;
    # por isso o id do hexágono segue numa coluna com outro nome.
    hex_entrada = hexagonos[["id", "geometry"]].rename(columns={"id": "hexagono"}).reset_index(drop=True)
    with rasterio.open(raster) as fonte:
        hex_raster = hex_entrada.to_crs(fonte.crs)
        if not _contem(fonte.bounds, tuple(hex_raster.total_bounds)):
            raise ValueError(
                f"O ficheiro {fonte_nome} não cobre toda a área de estudo "
                f"(ficheiro: {tuple(round(v) for v in fonte.bounds)}, "
                f"área: {tuple(round(v) for v in hex_raster.total_bounds)})."
            )
        resultado = exact_extract(fonte, hex_raster, "sum", include_cols=["hexagono"], output="pandas")

    if len(resultado) != len(hex_entrada) or set(resultado["hexagono"]) != set(hex_entrada["hexagono"]):
        raise RuntimeError("A extração não devolveu um valor por hexágono.")
    resultado = resultado.rename(columns={"hexagono": "id", "sum": "valor"})
    resultado["valor"] = resultado["valor"].fillna(0.0).clip(lower=0.0)
    return resultado[["id", "valor"]]


def total_na_area(raster: str, area: gpd.GeoDataFrame) -> float:
    """Soma do raster em toda a área de estudo (para conferir as somas por hexágono)."""
    with rasterio.open(raster) as fonte:
        forma = gpd.GeoDataFrame(geometry=[area.to_crs(fonte.crs).union_all()], crs=fonte.crs)
        resultado = exact_extract(fonte, forma, "sum", output="pandas")
    return float(resultado["sum"].iloc[0] or 0.0)




def diferenca_relativa(soma_hexagonos: float, total_referencia: float) -> float:
    """Diferença relativa entre a soma por hexágono e o total direto sobre a área."""
    if total_referencia == 0:
        return 0.0 if soma_hexagonos == 0 else float("inf")
    return abs(soma_hexagonos - total_referencia) / total_referencia
