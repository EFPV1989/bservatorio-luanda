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


def _area(args: argparse.Namespace) -> int:
    origem = gpd.read_file(args.origem)
    if args.campo not in origem.columns:
        print(f"Erro: a coluna '{args.campo}' não existe em {args.origem}.", file=sys.stderr)
        return 1
    selecao = origem[origem[args.campo] == args.valor]
    if selecao.empty:
        print(f"Erro: nenhuma geometria com {args.campo} = '{args.valor}'.", file=sys.stderr)
        return 1
    if not selecao.is_valid.all():
        print("Erro: a geometria selecionada não é válida.", file=sys.stderr)
        return 1

    area = gpd.GeoDataFrame(
        {"nome": [args.nome], "fonte": [args.fonte], "provisoria": [False]},
        geometry=[selecao.to_crs("EPSG:4326").union_all()],
        crs="EPSG:4326",
    )
    saida = Path(args.saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    area.to_file(saida, driver="GeoJSON", COORDINATE_PRECISION=6)
    area_km2 = area.to_crs("EPSG:32733").area.iloc[0] / 1e6
    print(f"Área de estudo: {args.nome} ({area_km2:,.0f} km²) gravada em {saida}")
    return 0


def _processar_rasters(args: argparse.Namespace, ano_do_ficheiro, processar_ano) -> int:
    """Passos comuns às fontes em raster: lê a grelha, processa cada ano, valida e carrega.

    `processar_ano(ano, raster, contexto)` devolve (valores com `id` e `valor`,
    linha de resumo, lista de problemas, lista de notas informativas).
    """
    from observatorio import postgis
    from observatorio.raster import caminho_raster

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Erro: defina DATABASE_URL (a grelha e a área de estudo são lidas do PostGIS).", file=sys.stderr)
        return 1

    ficheiros = sorted(args.ficheiros, key=ano_do_ficheiro)
    anos = [ano_do_ficheiro(f) for f in ficheiros]
    if len(set(anos)) != len(anos):
        print(f"Erro: há anos repetidos nos ficheiros: {anos}", file=sys.stderr)
        return 1

    hexagonos = postgis.ler_hexagonos_recortados(url, args.lado)
    contexto = {
        "area": postgis.ler_area_estudo(url),
        "hexagonos": hexagonos,
        "areas_m2": hexagonos.set_index("id")["area_m2"],
        "area_total_km2": float(hexagonos["area_m2"].sum()) / 1e6,
    }
    print(f"{len(hexagonos):,} hexágonos, {contexto['area_total_km2']:,.0f} km² de área de estudo")

    valores_por_ano = {}
    problemas_totais = []
    for ano, ficheiro in zip(anos, ficheiros):
        valores, resumo, problemas, notas = processar_ano(ano, caminho_raster(ficheiro), contexto)
        print(f"  {ano}: {resumo} — {'ok' if not problemas else 'PROBLEMAS'}")
        for linha in problemas + notas:
            print(f"      - {linha}")
        problemas_totais += problemas
        valores_por_ano[ano] = valores

    if problemas_totais:
        print("Erro: os dados não passaram a validação; nada foi carregado.", file=sys.stderr)
        return 1
    if args.simular:
        print("Simulação: nada foi carregado.")
        return 0

    n = postgis.carregar_valores(url, args.camada, valores_por_ano)
    print(f"Carregados {n:,} valores na camada '{args.camada}' ({len(anos)} anos).")
    return 0


def _ghsl(args: argparse.Namespace) -> int:
    from observatorio import ghsl

    def processar_ano(ano, raster, ctx):
        valores = ghsl.superficie_por_hexagono(raster, ctx["hexagonos"])
        problemas = ghsl.validar(valores, ctx["areas_m2"], ghsl.total_na_area(raster, ctx["area"]))
        km2 = valores["construido_m2"].sum() / 1e6
        resumo = f"{km2:8,.1f} km² construídos ({km2 / ctx['area_total_km2']:6.2%} da área)"
        return valores.rename(columns={"construido_m2": "valor"}), resumo, problemas, []

    return _processar_rasters(args, ghsl.ano_do_ficheiro, processar_ano)


def _worldpop(args: argparse.Namespace) -> int:
    from observatorio import worldpop
    from observatorio.raster import soma_por_hexagono, total_na_area

    def processar_ano(ano, raster, ctx):
        valores = soma_por_hexagono(raster, ctx["hexagonos"], fonte_nome="do WorldPop")
        problemas = worldpop.validar(valores, total_na_area(raster, ctx["area"]))
        total = float(valores["valor"].sum())
        resumo = f"{total:12,.0f} pessoas ({total / ctx['area_total_km2']:,.0f} por km²)"
        censo = worldpop.comparar_com_censo(ano, total)
        return valores, resumo, problemas, [censo] if censo else []

    return _processar_rasters(args, worldpop.ano_do_ficheiro, processar_ano)


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

    a = sub.add_parser("area", help="Extrai a área de estudo de um ficheiro de limites administrativos")
    a.add_argument("--origem", required=True, help="Ficheiro de limites (ex.: ago_admin1.shp do HDX)")
    a.add_argument("--campo", default="adm1_name", help="Coluna com o nome da unidade (padrão: adm1_name)")
    a.add_argument("--valor", default="Luanda", help="Unidade a extrair (padrão: Luanda)")
    a.add_argument("--nome", required=True, help="Nome da área de estudo")
    a.add_argument("--fonte", required=True, help="Fonte dos limites, para citar no site")
    a.add_argument("--saida", default="dados/area_estudo.geojson", help="GeoJSON de saída")
    a.set_defaults(func=_area)

    g = sub.add_parser("ghsl", help="Calcula a superfície construída (GHSL) por hexágono e carrega-a")
    g.add_argument("ficheiros", nargs="+", help="Ficheiros GHS-BUILT-S (.zip ou .tif), um por ano")
    g.add_argument("--lado", type=int, default=500, help="Lado da grelha em metros (padrão: 500)")
    g.add_argument("--camada", default="superficie-construida", help="Id da camada no catálogo")
    g.add_argument("--simular", action="store_true", help="Calcula e valida sem carregar no PostGIS")
    g.set_defaults(func=_ghsl)

    w = sub.add_parser("worldpop", help="Calcula a população estimada (WorldPop) por hexágono e carrega-a")
    w.add_argument("ficheiros", nargs="+", help="Ficheiros ago_pop_<ano>_CN_100m_R2025A_v1.tif, um por ano")
    w.add_argument("--lado", type=int, default=500, help="Lado da grelha em metros (padrão: 500)")
    w.add_argument("--camada", default="populacao", help="Id da camada no catálogo")
    w.add_argument("--simular", action="store_true", help="Calcula e valida sem carregar no PostGIS")
    w.set_defaults(func=_worldpop)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
