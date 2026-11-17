"""Carga da área de estudo e da grelha para o PostGIS.

As tabelas são criadas pelas migrações da API (AdonisJS). Este módulo só
substitui o conteúdo delas, dentro de uma transação.
"""

from __future__ import annotations

import geopandas as gpd
import psycopg
from shapely.geometry import MultiPolygon


def _multipoligono(geom) -> MultiPolygon:
    return geom if isinstance(geom, MultiPolygon) else MultiPolygon([geom])


def carregar(
    url: str,
    area: gpd.GeoDataFrame,
    grelha: gpd.GeoDataFrame,
    *,
    nome_area: str,
    fonte_area: str,
    provisoria: bool,
    lado: int,
) -> tuple[int, int]:
    """Substitui a área de estudo e a grelha de lado `lado`. Devolve (áreas, hexágonos)."""
    forma = _multipoligono(area.to_crs("EPSG:4326").union_all())

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM area_estudo")
        cur.execute(
            """
            INSERT INTO area_estudo (nome, fonte, provisoria, geom)
            VALUES (%s, %s, %s, ST_Multi(ST_GeomFromText(%s, 4326)))
            """,
            (nome_area, fonte_area, provisoria, forma.wkt),
        )

        # COPY para uma tabela temporária (rápido) e conversão da geometria
        # numa só instrução para a tabela final.
        cur.execute(
            """
            CREATE TEMP TABLE grelha_carga (
              id text, linha integer, coluna integer,
              area_km2 double precision, fracao_na_area double precision, wkt text
            ) ON COMMIT DROP
            """
        )
        with cur.copy(
            "COPY grelha_carga (id, linha, coluna, area_km2, fracao_na_area, wkt) FROM STDIN"
        ) as copy:
            for hexagono in grelha.itertuples(index=False):
                copy.write_row(
                    (
                        hexagono.id,
                        hexagono.linha,
                        hexagono.coluna,
                        hexagono.area_km2,
                        hexagono.fracao_na_area,
                        hexagono.geometry.wkt,
                    )
                )
        cur.execute("DELETE FROM grelha_hexagonos WHERE lado_m = %s", (lado,))
        cur.execute(
            """
            INSERT INTO grelha_hexagonos (id, lado_m, linha, coluna, area_km2, fracao_na_area, geom)
            SELECT id, %s, linha, coluna, area_km2, fracao_na_area, ST_GeomFromText(wkt, 4326)
              FROM grelha_carga
            """,
            (lado,),
        )
        conn.commit()

    return 1, len(grelha)
