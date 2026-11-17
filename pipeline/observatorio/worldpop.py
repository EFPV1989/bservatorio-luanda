"""População estimada do WorldPop (Global 2015–2030, R2025A, 100 m) por hexágono.

Cada ficheiro é um raster de Angola (WGS84, ~100 m) em que cada célula guarda o
número estimado de pessoas residentes, num ano. A soma por hexágono está em
`observatorio.raster`; aqui ficam as regras próprias do WorldPop.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from observatorio.raster import diferenca_relativa

_ANO = re.compile(r"_pop_(\d{4})_")

#: População dos censos do INE na área de estudo (antiga província de Luanda,
#: limites de 2011), para comparar com as estimativas do WorldPop.
#: 2024: província de Luanda (8 665 510) + Icolo e Bengo (1 523 457), resultados
#: definitivos do RGPH 2024 publicados pelo INE.
CENSOS_AREA_ESTUDO: dict[int, int] = {2024: 8_665_510 + 1_523_457}


def ano_do_ficheiro(caminho: str | Path) -> int:
    """Ano a partir do nome oficial, por exemplo ago_pop_2020_CN_100m_R2025A_v1.tif → 2020."""
    encontrado = _ANO.search(Path(caminho).name)
    if not encontrado:
        raise ValueError(f"Não encontro o ano no nome do ficheiro: {Path(caminho).name}")
    return int(encontrado.group(1))


def validar(valores: pd.DataFrame, total_referencia: float, *, tolerancia_total: float = 0.005) -> list[str]:
    """A soma dos hexágonos tem de bater com a soma direta sobre a área de estudo."""
    soma = float(valores["valor"].sum())
    diferenca = diferenca_relativa(soma, total_referencia)
    if diferenca > tolerancia_total:
        return [
            f"A soma por hexágono ({soma:,.0f} pessoas) difere {diferenca:.2%} do total da área "
            f"({total_referencia:,.0f} pessoas)."
        ]
    return []


def comparar_com_censo(ano: int, total: float) -> str | None:
    """Frase com a diferença para o censo desse ano, se houver censo; senão `None`."""
    censo = CENSOS_AREA_ESTUDO.get(ano)
    if censo is None:
        return None
    diferenca = (total - censo) / censo
    return f"Censo {ano}: {censo:,} pessoas; o WorldPop estima {total:,.0f} ({diferenca:+.1%})."
