"""Carga da área de estudo e da grelha para o PostGIS.

As tabelas são criadas pelas migrações da API (AdonisJS). Este módulo só
substitui o conteúdo delas, dentro de uma transação.
"""

from __future__ import annotations

import geopandas as gpd
import pandas as pd
import psycopg
from shapely import wkb
from shapely.geometry import MultiPolygon


def _ler(url: str, sql: str, params: dict | None = None) -> gpd.GeoDataFrame:
    """Executa `sql` (com a geometria em WKB na coluna `geom`) e devolve um GeoDataFrame em WGS84."""
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(sql, params or {})
        colunas = [c.name for c in cur.description]
        linhas = cur.fetchall()
    tabela = pd.DataFrame(linhas, columns=colunas)
    geometrias = [wkb.loads(bytes(g)) for g in tabela.pop("geom")]
    return gpd.GeoDataFrame(tabela, geometry=geometrias, crs="EPSG:4326")


def ler_area_estudo(url: str) -> gpd.GeoDataFrame:
    """A área de estudo carregada (uma só geometria)."""
    area = _ler(url, "SELECT ST_AsBinary(geom) AS geom FROM area_estudo ORDER BY id DESC LIMIT 1")
    if area.empty:
        raise ValueError("A área de estudo ainda não foi carregada (comando 'grelha --carregar').")
    return area


def ler_hexagonos_recortados(url: str, lado: int) -> gpd.GeoDataFrame:
    """Hexágonos da grelha recortados à área de estudo, com a área (m²) da parte recortada.

    Os hexágonos inteiramente dentro da área (fração 1) não precisam de recorte.
    """
    sql = """
        SELECT h.id,
               h.area_km2 * h.fracao_na_area * 1e6 AS area_m2,
               ST_AsBinary(
                 CASE WHEN h.fracao_na_area >= 1 THEN h.geom
                      ELSE ST_Multi(ST_CollectionExtract(ST_Intersection(h.geom, a.geom), 3))
                 END
               ) AS geom
          FROM grelha_hexagonos h
         CROSS JOIN (SELECT geom FROM area_estudo ORDER BY id DESC LIMIT 1) a
         WHERE h.lado_m = %(lado)s
         ORDER BY h.id
    """
    hexagonos = _ler(url, sql, {"lado": lado})
    if hexagonos.empty:
        raise ValueError(f"Não há grelha de {lado} m carregada (comando 'grelha --carregar').")
    hexagonos["area_m2"] = hexagonos["area_m2"].astype(float)
    return hexagonos


def carregar_valores(url: str, camada: str, valores_por_ano: dict[int, pd.DataFrame]) -> int:
    """Substitui os valores da `camada` nos anos dados e marca a camada como disponível.

    Cada DataFrame tem as colunas `id` (hexágono) e `valor`. Tudo numa só transação.
    """
    total = 0
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM camadas WHERE id = %s", (camada,))
        if cur.fetchone() is None:
            raise ValueError(f"A camada '{camada}' não existe no catálogo (corra o seeder da API).")
        anos = sorted(valores_por_ano)
        cur.execute("DELETE FROM valores_camada WHERE camada_id = %s AND ano = ANY(%s)", (camada, anos))
        with cur.copy("COPY valores_camada (camada_id, hexagono_id, ano, valor) FROM STDIN") as copy:
            for ano in anos:
                for linha in valores_por_ano[ano].itertuples(index=False):
                    copy.write_row((camada, linha.id, ano, float(linha.valor)))
                    total += 1
        cur.execute(
            """
            UPDATE camadas
               SET disponivel = true,
                   anos = (SELECT array_agg(DISTINCT ano ORDER BY ano) FROM valores_camada WHERE camada_id = %(c)s),
                   updated_at = now()
             WHERE id = %(c)s
            """,
            {"c": camada},
        )
        conn.commit()
    return total


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
