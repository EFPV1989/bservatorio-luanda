"""Superfície construída da GHSL (GHS-BUILT-S R2023A) por hexágono.

Cada ficheiro da GHSL é um raster de 100 m (projeção Mollweide, ESRI:54009) em
que cada célula guarda os m² construídos nessa célula, num ano ("época").

A soma por hexágono está em `observatorio.raster`; aqui ficam as regras
próprias da GHSL (ano no nome do ficheiro, validação da área construída).
"""

from __future__ import annotations

import re
from pathlib import Path

import geopandas as gpd
import pandas as pd

from observatorio.raster import caminho_raster, diferenca_relativa, soma_por_hexagono, total_na_area

__all__ = ["ano_do_ficheiro", "caminho_raster", "superficie_por_hexagono", "total_na_area", "validar"]

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


def superficie_por_hexagono(raster: str, hexagonos: gpd.GeoDataFrame) -> pd.DataFrame:
    """Soma dos m² construídos por hexágono: DataFrame com `id` e `construido_m2`."""
    valores = soma_por_hexagono(raster, hexagonos, fonte_nome="da GHSL")
    return valores.rename(columns={"valor": "construido_m2"})


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
    diferenca = diferenca_relativa(soma, total_referencia)
    if diferenca > tolerancia_total:
        problemas.append(
            f"A soma por hexágono ({soma:,.0f} m²) difere {diferenca:.2%} do total da área "
            f"({total_referencia:,.0f} m²)."
        )
    return problemas
