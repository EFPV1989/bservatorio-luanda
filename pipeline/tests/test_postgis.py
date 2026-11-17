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


def test_hexagonos_recortados_e_carga_de_valores():
    import pandas as pd

    from observatorio.postgis import carregar_valores, ler_area_estudo, ler_hexagonos_recortados

    area = gpd.GeoDataFrame(geometry=[box(300_000, 8_950_000, 302_100, 8_952_100)], crs=CRS_METRICO)
    grelha = gerar_grelha(area, lado=500)
    carregar(URL, area, grelha, nome_area="Teste", fonte_area="teste", provisoria=True, lado=500)
    with psycopg.connect(URL) as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO camadas (id, nome, descricao, fonte_nome, fonte_url, licenca, ano_inicio, ano_fim,"
            " resolucao) VALUES ('teste-camada', 't', 't', 't', 'https://t', 't', 2000, 2020, '1 m')"
            " ON CONFLICT (id) DO NOTHING"
        )
        conn.commit()

    try:
        assert len(ler_area_estudo(URL)) == 1
        hexagonos = ler_hexagonos_recortados(URL, 500)
        assert len(hexagonos) == len(grelha)
        # A soma das partes recortadas é a área de estudo (2,1 km x 2,1 km).
        assert hexagonos["area_m2"].sum() == pytest.approx(2100 * 2100, rel=1e-3)
        assert hexagonos.to_crs(CRS_METRICO).area.sum() == pytest.approx(2100 * 2100, rel=1e-3)

        valores = pd.DataFrame({"id": hexagonos["id"], "valor": 100.0})
        n = carregar_valores(URL, "teste-camada", {2000: valores, 2020: valores})
        assert n == 2 * len(hexagonos)
        carregar_valores(URL, "teste-camada", {2020: valores})  # recarregar um ano não duplica
        with psycopg.connect(URL) as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM valores_camada WHERE camada_id = 'teste-camada'")
            assert cur.fetchone()[0] == 2 * len(hexagonos)
            cur.execute("SELECT disponivel, anos FROM camadas WHERE id = 'teste-camada'")
            assert cur.fetchone() == (True, [2000, 2020])
    finally:
        with psycopg.connect(URL) as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM camadas WHERE id = 'teste-camada'")
            cur.execute("DELETE FROM grelha_hexagonos")
            cur.execute("DELETE FROM area_estudo")
            conn.commit()
