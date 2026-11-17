import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

from observatorio.ghsl import (
    ano_do_ficheiro,
    caminho_raster,
    superficie_por_hexagono,
    total_na_area,
    validar,
)
from observatorio.grelha import gerar_grelha

MOLLWEIDE = "ESRI:54009"
X0, Y0, CELULA, N = 1_300_000, -1_000_000, 100, 60  # 6 km x 6 km de células de 100 m


def _raster(tmp_path, valores, nome="GHS_BUILT_S_E2020_GLOBE_R2023A_54009_100_V1_0_R11_C20.tif", nodata=65535):
    caminho = tmp_path / nome
    with rasterio.open(
        caminho, "w", driver="GTiff", width=N, height=N, count=1, dtype="uint16",
        crs=MOLLWEIDE, transform=from_origin(X0, Y0, CELULA, CELULA), nodata=nodata,
    ) as dst:
        dst.write(valores.astype("uint16"), 1)
    return caminho


def _area(margem=1000):
    """Área de estudo dentro do raster, com margem (em metros Mollweide)."""
    return gpd.GeoDataFrame(
        geometry=[box(X0 + margem, Y0 - N * CELULA + margem, X0 + N * CELULA - margem, Y0 - margem)],
        crs=MOLLWEIDE,
    )


def _hexagonos_recortados(area):
    # Recorte feito na mesma projeção da área, como o PostGIS faz com geometrias na mesma projeção.
    grelha = gerar_grelha(area.to_crs("EPSG:4326"), lado=500).to_crs(MOLLWEIDE)
    grelha["geometry"] = grelha.geometry.intersection(area.union_all())
    grelha = grelha[~grelha.geometry.is_empty & (grelha.area > 0)].copy()
    grelha["area_m2"] = grelha.area
    return grelha


def test_ano_vem_do_nome_oficial():
    assert ano_do_ficheiro("GHS_BUILT_S_E1975_GLOBE_R2023A_54009_100_V1_0_R11_C20.zip") == 1975
    with pytest.raises(ValueError):
        ano_do_ficheiro("qualquer_coisa.zip")


def test_le_o_tif_de_dentro_do_zip(tmp_path):
    tif = _raster(tmp_path, np.full((N, N), 100))
    zip_ = tmp_path / "GHS_BUILT_S_E2020.zip"
    with zipfile.ZipFile(zip_, "w") as z:
        z.write(tif, tif.name)
    caminho = caminho_raster(zip_)
    assert caminho.startswith("zip://") and caminho.endswith(tif.name)
    with rasterio.open(caminho) as fonte:
        assert fonte.width == N


def test_soma_por_hexagono_conserva_o_total(tmp_path):
    # 25% de cada célula construída (2 500 m² em 10 000 m²).
    raster = str(_raster(tmp_path, np.full((N, N), 2500)))
    area = _area()
    hexagonos = _hexagonos_recortados(area)

    valores = superficie_por_hexagono(raster, hexagonos)
    total = total_na_area(raster, area)
    area_m2 = float(area.area.iloc[0])

    assert total == pytest.approx(area_m2 * 0.25, rel=1e-6)
    assert valores["construido_m2"].sum() == pytest.approx(total, rel=1e-4)
    # Cada hexágono tem 25% da sua área construída, mesmo os recortados na borda.
    por_hexagono = valores.set_index("id")["construido_m2"] / hexagonos.set_index("id")["area_m2"]
    assert por_hexagono.min() == pytest.approx(0.25, rel=1e-3)
    assert por_hexagono.max() == pytest.approx(0.25, rel=1e-3)
    assert validar(valores, hexagonos.set_index("id")["area_m2"], total) == []


def test_celulas_sem_dados_nao_contam(tmp_path):
    grelha = np.full((N, N), 1000)
    grelha[:, : N // 2] = 65535  # metade do raster sem dados
    raster = str(_raster(tmp_path, grelha))
    area = _area()
    total = total_na_area(raster, area)
    assert total < float(area.area.iloc[0]) * 0.1 * 0.6  # só a metade com dados conta


def test_recusa_ficheiro_que_nao_cobre_a_area(tmp_path):
    raster = str(_raster(tmp_path, np.zeros((N, N))))
    fora = gpd.GeoDataFrame(geometry=[box(X0 - 5000, Y0 - 3000, X0 + 1000, Y0 - 1000)], crs=MOLLWEIDE)
    with pytest.raises(ValueError, match="não cobre"):
        superficie_por_hexagono(raster, _hexagonos_recortados(fora))


def test_validar_aponta_excessos_e_somas_que_nao_batem():
    valores = pd.DataFrame({"id": ["a", "b"], "construido_m2": [500.0, 200.0]})
    areas = pd.Series({"a": 400.0, "b": 1000.0})
    problemas = validar(valores, areas, total_referencia=1000.0)
    assert any("mais área construída" in p for p in problemas)
    assert any("difere" in p for p in problemas)
    assert validar(valores.assign(construido_m2=[300.0, 200.0]), areas, total_referencia=500.0) == []
