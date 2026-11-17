import math

import geopandas as gpd
import pytest
from shapely.geometry import box

from observatorio.grelha import CRS_METRICO, Geometria, gerar_grelha, identificador


def _area_metrica(xmin, ymin, xmax, ymax):
    return gpd.GeoDataFrame(geometry=[box(xmin, ymin, xmax, ymax)], crs=CRS_METRICO)


def test_hexagono_tem_lado_e_area_corretos():
    geo = Geometria(500)
    hexagono = geo.poligono(0, 0)
    coords = list(hexagono.exterior.coords)[:-1]
    assert len(coords) == 6
    for a, b in zip(coords, coords[1:] + coords[:1]):
        assert math.dist(a, b) == pytest.approx(500)
    assert hexagono.area == pytest.approx(geo.area_m2)
    assert geo.area_m2 / 1e6 == pytest.approx(0.6495, abs=1e-4)


def test_vizinhos_nao_se_sobrepoem_e_nao_deixam_buracos():
    geo = Geometria(500)
    celulas = [geo.poligono(l, c) for l in range(-2, 3) for c in range(-2, 3)]
    for i, a in enumerate(celulas):
        for b in celulas[i + 1 :]:
            assert a.intersection(b).area == pytest.approx(0, abs=1e-6)
    # Sem frestas: a união é um só polígono sem buracos.
    from shapely.ops import unary_union

    uniao = unary_union(celulas)
    assert uniao.geom_type == "Polygon"
    assert len(uniao.interiors) == 0
    # O hexágono central partilha um lado inteiro com cada um dos 6 vizinhos.
    centro = geo.poligono(0, 0)
    vizinhos = [c for c in celulas if not c.equals(centro) and c.intersection(centro).length > 499]
    assert len(vizinhos) == 6


def test_grelha_cobre_a_area_sem_hexagonos_a_mais():
    area = _area_metrica(300_000, 8_950_000, 310_000, 8_960_000)  # 10 km x 10 km
    grelha = gerar_grelha(area, lado=500).to_crs(CRS_METRICO)
    # Cobertura: a soma das partes dentro da área é a área inteira.
    coberto = (grelha["fracao_na_area"] * grelha["area_km2"]).sum()
    assert coberto == pytest.approx(100, rel=1e-3)
    # Todos os hexágonos têm área em comum com a área de estudo.
    assert (grelha["fracao_na_area"] > 0).all()
    assert (grelha["fracao_na_area"] <= 1).all()
    assert grelha["id"].is_unique


def test_ids_sao_estaveis_quando_a_area_muda():
    pequena = gerar_grelha(_area_metrica(300_000, 8_950_000, 305_000, 8_955_000))
    grande = gerar_grelha(_area_metrica(299_000, 8_949_000, 306_000, 8_956_000))
    comuns = pequena.merge(grande, on="id", suffixes=("_p", "_g"))
    assert len(comuns) == len(pequena)
    assert all(a.equals_exact(b, 1e-9) for a, b in zip(comuns["geometry_p"], comuns["geometry_g"]))


def test_saida_em_wgs84_e_id_legivel():
    grelha = gerar_grelha(_area_metrica(300_000, 8_950_000, 301_000, 8_951_000))
    assert grelha.crs.to_epsg() == 4326
    assert identificador(500, -3, 7) == "h500_r-3_c7"


def test_erros_claros():
    with pytest.raises(ValueError):
        gerar_grelha(gpd.GeoDataFrame(geometry=[box(0, 0, 1, 1)]))  # sem CRS
    with pytest.raises(ValueError):
        gerar_grelha(_area_metrica(0, 0, 1, 1), lado=0)
