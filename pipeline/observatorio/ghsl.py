"""Superfície construída da GHSL (GHS-BUILT-S R2023A) por hexágono.

Cada ficheiro da GHSL é um raster de 100 m (projeção Mollweide, ESRI:54009) em
que cada célula guarda os m² construídos nessa célula, num ano ("época").

Para cada hexágono somamos os m² das células que caem dentro dele, pesando cada
célula pela fração da sua área que está dentro do hexágono (as células nas
bordas contam só em parte). Usa-se o hexágono recortado à área de estudo, para
que nada fora da área (mar, províncias vizinhas) entre na soma.
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import rasterio
from exactextract import exact_extract
from rasterio.coords import BoundingBox

_ANO = re.compile(r"_E(\d{4})_")

#: Tolerância para arredondamentos: um hexágono não pode ter mais construído
#: do que a sua área, mas somas de células parciais podem passar um pouco.
TOLERANCIA_AREA = 1.001


def ano_do_ficheiro(caminho: str | Path) -> int:
    """Ano (época) a partir do nome oficial, por exemplo ..._E1975_GLOBE_... → 1975."""
    encontrado = _ANO.search(Path(caminho).name)
    if not encontrado:
        raise ValueError(f"Não encontro o ano no nome do ficheiro: {Path(caminho).name}")
    return int(encontrado.group(1))


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


def superficie_por_hexagono(raster: str, hexagonos: gpd.GeoDataFrame) -> pd.DataFrame:
    """Soma dos m² construídos por hexágono.

    `hexagonos` tem as colunas `id` e `geometry` (já recortadas à área de estudo).
    Devolve um DataFrame com `id` e `construido_m2`.
    """
    # O exactextract trata uma coluna chamada "id" como o número da linha;
    # por isso o id do hexágono segue numa coluna com outro nome.
    hex_entrada = hexagonos[["id", "geometry"]].rename(columns={"id": "hexagono"}).reset_index(drop=True)
    with rasterio.open(raster) as fonte:
        hex_raster = hex_entrada.to_crs(fonte.crs)
        if not _contem(fonte.bounds, tuple(hex_raster.total_bounds)):
            raise ValueError(
                "O ficheiro da GHSL não cobre toda a área de estudo "
                f"(ficheiro: {tuple(round(v) for v in fonte.bounds)}, "
                f"área: {tuple(round(v) for v in hex_raster.total_bounds)})."
            )
        resultado = exact_extract(fonte, hex_raster, "sum", include_cols=["hexagono"], output="pandas")

    if len(resultado) != len(hex_entrada) or set(resultado["hexagono"]) != set(hex_entrada["hexagono"]):
        raise RuntimeError("A extração não devolveu um valor por hexágono.")
    resultado = resultado.rename(columns={"hexagono": "id", "sum": "construido_m2"})
    resultado["construido_m2"] = resultado["construido_m2"].fillna(0.0).clip(lower=0.0)
    return resultado[["id", "construido_m2"]]


def total_na_area(raster: str, area: gpd.GeoDataFrame) -> float:
    """Soma dos m² construídos em toda a área de estudo (para conferir as somas por hexágono)."""
    with rasterio.open(raster) as fonte:
        forma = gpd.GeoDataFrame(geometry=[area.to_crs(fonte.crs).union_all()], crs=fonte.crs)
        resultado = exact_extract(fonte, forma, "sum", output="pandas")
    return float(resultado["sum"].iloc[0] or 0.0)


def validar(
    valores: pd.DataFrame, areas_m2: pd.Series, total_referencia: float, *, tolerancia_total: float = 0.005
) -> list[str]:
    """Confirma que os resultados fazem sentido. Devolve a lista de problemas (vazia se tudo bem).

    - nenhum hexágono pode ter mais construído do que a sua área;
    - a soma dos hexágonos tem de bater com a soma direta sobre a área de estudo.
    """
    problemas = []
    excesso = valores.set_index("id")["construido_m2"] > areas_m2.reindex(valores["id"]).values * TOLERANCIA_AREA
    if excesso.any():
        problemas.append(f"{int(excesso.sum())} hexágonos com mais área construída do que área total.")

    soma = float(valores["construido_m2"].sum())
    if total_referencia > 0:
        diferenca = abs(soma - total_referencia) / total_referencia
        if diferenca > tolerancia_total:
            problemas.append(
                f"A soma por hexágono ({soma:,.0f} m²) difere {diferenca:.2%} do total da área "
                f"({total_referencia:,.0f} m²)."
            )
    elif soma > 0:
        problemas.append("Há área construída nos hexágonos mas não no total da área.")
    return problemas
