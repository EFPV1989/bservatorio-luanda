import geopandas as gpd
from shapely.geometry import box

from observatorio.__main__ import main


def _limites(tmp_path):
    origem = gpd.GeoDataFrame(
        {"adm1_name": ["Luanda", "Bengo"]},
        geometry=[box(13.0, -9.0, 13.5, -8.8), box(13.5, -9.0, 14.0, -8.5)],
        crs="EPSG:4326",
    )
    caminho = tmp_path / "limites.geojson"
    origem.to_file(caminho, driver="GeoJSON")
    return caminho


def test_area_extrai_a_unidade_pedida(tmp_path):
    saida = tmp_path / "area.geojson"
    codigo = main(
        ["area", "--origem", str(_limites(tmp_path)), "--nome", "Teste", "--fonte", "HDX", "--saida", str(saida)]
    )
    assert codigo == 0
    area = gpd.read_file(saida)
    assert len(area) == 1
    assert area["nome"].iloc[0] == "Teste"
    assert area["fonte"].iloc[0] == "HDX"
    assert not bool(area["provisoria"].iloc[0])
    assert area.geometry.iloc[0].bounds == (13.0, -9.0, 13.5, -8.8)


def test_area_falha_com_mensagem_se_a_unidade_nao_existe(tmp_path, capsys):
    codigo = main(
        ["area", "--origem", str(_limites(tmp_path)), "--valor", "Huambo", "--nome", "x", "--fonte", "x",
         "--saida", str(tmp_path / "a.geojson")]
    )
    assert codigo == 1
    assert "Huambo" in capsys.readouterr().err
