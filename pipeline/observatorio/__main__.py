"""Linha de comandos do pipeline.

Exemplos (a partir da pasta pipeline/):

    python -m observatorio grelha --area dados/area_provisoria.geojson
    python -m observatorio grelha --area dados/area_estudo.geojson --carregar
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

from observatorio.grelha import gerar_grelha


def _propriedade(area: gpd.GeoDataFrame, coluna: str, padrao):
    """Valor da propriedade `coluna` na primeira geometria, ou `padrao` se não existir."""
    if coluna in area.columns and pd.notna(area[coluna].iloc[0]):
        return area[coluna].iloc[0]
    return padrao


def _grelha(args: argparse.Namespace) -> int:
    area = gpd.read_file(args.area)
    if area.empty:
        print(f"Erro: {args.area} não tem geometrias.", file=sys.stderr)
        return 1

    provisoria = bool(_propriedade(area, "provisoria", False))
    nome = args.nome or str(_propriedade(area, "nome", "Área de estudo"))
    fonte = args.fonte or str(_propriedade(area, "fonte", "não indicada"))

    grelha = gerar_grelha(area, lado=args.lado)
    area_km2 = area.to_crs("EPSG:32733").union_all().area / 1e6
    print(f"Área de estudo: {nome} ({area_km2:,.0f} km²){' — PROVISÓRIA' if provisoria else ''}")
    print(f"Hexágonos de {args.lado} m de lado: {len(grelha):,}")

    saida = Path(args.saida or f"saida/grelha_{args.lado}m.geojson")
    saida.parent.mkdir(parents=True, exist_ok=True)
    grelha.to_file(saida, driver="GeoJSON")
    print(f"Grelha gravada em {saida}")

    if args.carregar:
        url = os.environ.get("DATABASE_URL")
        if not url:
            print("Erro: defina DATABASE_URL para carregar no PostGIS.", file=sys.stderr)
            return 1
        from observatorio.postgis import carregar

        _, n = carregar(
            url, area, grelha, nome_area=nome, fonte_area=fonte, provisoria=provisoria, lado=args.lado
        )
        print(f"Carregados no PostGIS: área de estudo e {n:,} hexágonos")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="observatorio", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("grelha", help="Gera a grelha hexagonal da área de estudo")
    p.add_argument("--area", required=True, help="Ficheiro da área de estudo (GeoJSON, GeoPackage, Shapefile)")
    p.add_argument("--lado", type=int, default=500, help="Lado do hexágono em metros (padrão: 500)")
    p.add_argument("--saida", help="Ficheiro GeoJSON de saída (padrão: saida/grelha_<lado>m.geojson)")
    p.add_argument("--nome", help="Nome da área de estudo (padrão: propriedade 'nome' do ficheiro)")
    p.add_argument("--fonte", help="Fonte dos limites (padrão: propriedade 'fonte' do ficheiro)")
    p.add_argument("--carregar", action="store_true", help="Carregar também no PostGIS (usa DATABASE_URL)")
    p.set_defaults(func=_grelha)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
