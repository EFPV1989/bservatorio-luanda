import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

from observatorio.grelha import gerar_grelha
from observatorio.raster import soma_por_hexagono, total_na_area
from observatorio.worldpop import CENSOS_AREA_ESTUDO, ano_do_ficheiro, comparar_com_censo, validar

# ~3 segundos de arco (≈ 92 m em Luanda), como o WorldPop.
PASSO = 3 / 3600


def _raster(tmp_path, valores, x0=13.20, y0=-8.80):
    caminho = tmp_path / "ago_pop_2020_CN_100m_R2025A_v1.tif"
    with rasterio.open(
        caminho, "w", driver="GTiff", width=valores.shape[1], height=valores.shape[0], count=1,
        dtype="float32", crs="EPSG:4326", transform=from_origin(x0, y0, PASSO, PASSO), nodata=-99999,
    ) as dst:
        dst.write(valores.astype("float32"), 1)
    return str(caminho)


def test_ano_vem_do_nome_oficial():
    assert ano_do_ficheiro("ago_pop_2024_CN_100m_R2025A_v1.tif") == 2024
    with pytest.raises(ValueError):
        ano_do_ficheiro("ago_agesex_2024.tif")


def test_pessoas_somadas_por_hexagono_conservam_o_total(tmp_path):
    n = 80
    valores = np.full((n, n), 10.0)  # 10 pessoas por célula
    valores[20:30, 20:30] = -99999  # 100 células sem dados, dentro da área: não contam
    raster = _raster(tmp_path, valores)
    area = gpd.GeoDataFrame(geometry=[box(13.205, -8.86, 13.255, -8.805)], crs="EPSG:4326")
    hexagonos = gerar_grelha(area, lado=500)
    hexagonos["geometry"] = hexagonos.geometry.intersection(area.union_all())
    hexagonos = hexagonos[~hexagonos.geometry.is_empty]

    por_hex = soma_por_hexagono(raster, hexagonos)
    total = total_na_area(raster, area)
    celulas_na_area = area.union_all().area / (PASSO * PASSO)
    assert total == pytest.approx(10 * (celulas_na_area - 100), rel=1e-3)
    assert por_hex["valor"].sum() == pytest.approx(total, rel=1e-4)
    assert validar(por_hex, total) == []


def test_validar_e_comparacao_com_censo():
    valores = pd.DataFrame({"id": ["a"], "valor": [900.0]})
    assert validar(valores, 1000.0)  # 10% de diferença → problema
    assert comparar_com_censo(2020, 1.0) is None
    frase = comparar_com_censo(2024, CENSOS_AREA_ESTUDO[2024] * 1.05)
    assert "Censo 2024" in frase and "+5.0%" in frase
