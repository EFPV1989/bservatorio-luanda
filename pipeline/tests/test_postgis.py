"""Teste de integração da carga para o PostGIS.

Só corre se TEST_DATABASE_URL apontar para uma base de dados cujo nome termina
em "_test" e onde as migrações da API já foram aplicadas.
"""

import os

import geopandas as gpd
import psycopg
import pytest
from shapely.geometry import box

from observatorio.grelha import CRS_METRICO, gerar_grelha
from observatorio.postgis import carregar

URL = os.environ.get("TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not URL.rstrip("/").endswith("_test"),
    reason="defina TEST_DATABASE_URL para uma BD *_test com as migrações da API",
)


def test_carrega_area_e_grelha_e_substitui_numa_segunda_carga():
    area = gpd.GeoDataFrame(geometry=[box(300_000, 8_950_000, 303_000, 8_953_000)], crs=CRS_METRICO)
    grelha = gerar_grelha(area, lado=500)

    for _ in range(2):  # a segunda carga substitui, não duplica
        carregar(URL, area, grelha, nome_area="Teste", fonte_area="teste", provisoria=True, lado=500)

    with psycopg.connect(URL) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM area_estudo")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT count(*), bool_and(ST_IsValid(geom)) FROM grelha_hexagonos WHERE lado_m = 500")
        total, validos = cur.fetchone()
        assert total == len(grelha)
        assert validos is True
        # A área coberta no PostGIS bate com a área de estudo (9 km²).
        cur.execute("SELECT sum(area_km2 * fracao_na_area) FROM grelha_hexagonos WHERE lado_m = 500")
        assert cur.fetchone()[0] == pytest.approx(9, rel=1e-3)
        cur.execute("DELETE FROM grelha_hexagonos")
        cur.execute("DELETE FROM area_estudo")
        conn.commit()
