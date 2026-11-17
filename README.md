# Observatório do Crescimento de Luanda

Site público e gratuito que mostra, em mapas, como Luanda cresceu desde 1975: em área
urbana, em construção, em população e em serviços. Projeto pessoal de pesquisa, sem fins
comerciais.

O plano completo (perguntas de pesquisa, fontes, metodologia, fases e riscos) está no
[documento do projeto](https://claude.ai/artifact/2LvjrXRLfoq3prM3NMfssL).

## Estado atual: Fase 0 (esqueleto)

- O site abre com o mapa de Luanda e a grelha de análise (hexágonos de 500 m de lado).
- O deslizador de anos (1975–2030) e o catálogo de camadas já existem, mas ainda não há
  dados por ano: chegam na Fase 1 (superfície construída, GHSL).
- A área de estudo é a antiga província de Luanda (limites de 2011, com Icolo e Bengo e
  Quiçama), a partir dos limites oficiais do HDX: 30 995 hexágonos a cobrir 19 731 km².

## Estrutura

```
api/        API pública só de leitura — AdonisJS 6 + Lucid + PostGIS
web/        Site — Angular 18 + Tailwind 3 + MapLibre
pipeline/   Preparação de dados — Python (área de estudo, grelha, e depois os dados de satélite)
docker/     Script de arranque do PostGIS (cria a BD de testes)
```

O processamento pesado corre no `pipeline/`, fora do site, e grava os resultados no PostGIS.
A API só lê resultados já calculados e serve-os ao site, incluindo a grelha como tiles
vetoriais.

## Pôr a correr (desenvolvimento)

Requisitos: Docker, Node.js 20+, Python 3.11+.

```bash
# 1. Base de dados (PostgreSQL 17 + PostGIS 3.5, porta 5433)
docker compose up -d

# 2. API
cd api
cp .env.example .env
node ace generate:key          # preenche APP_KEY no .env
npm install
node ace migration:run
node ace db:seed               # catálogo de camadas
npm run dev                    # http://localhost:3333/api/v1/health

# 3. Grelha (noutro terminal)
cd pipeline
pip install -r requirements.txt
DATABASE_URL=postgres://observatorio:observatorio_dev@localhost:5433/observatorio_dev \
  python -m observatorio grelha --area dados/area_estudo.geojson --carregar

# 4. Site (noutro terminal)
cd web
npm install
npm start                      # http://localhost:4200
```

## Área de estudo

`pipeline/dados/area_estudo.geojson` é a **antiga província de Luanda** (limites de 2011:
Belas, Cacuaco, Cazenga, Icolo e Bengo, Luanda, Quiçama e Viana), extraída da camada ADM1
(código AO11) de
[OCHA/HDX – Angola Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-ago).
Foi gerada assim, a partir do Shapefile descarregado do HDX:

```bash
cd pipeline
python -m observatorio area --origem caminho/para/ago_admin1.shp \
  --nome "Antiga província de Luanda (limites de 2011)" \
  --fonte "OCHA/HDX COD-AB Angola (ADM1, AO11)"
```

Uma nova carga da grelha substitui a área e a grelha anteriores. Os ids dos hexágonos não
mudam com a área: o mesmo sítio tem sempre o mesmo id.

## API

Prefixo `/api/v1`. Respostas no envelope `{ success, data, meta: { requestId } }`.

| Rota | Devolve |
| --- | --- |
| `GET /health`, `GET /health/ready` | Estado do serviço e da base de dados |
| `GET /area-estudo` | Contorno da área de estudo (GeoJSON Feature), com `provisoria` |
| `GET /grelha` | Resumo da grelha: lado, nº de hexágonos, área coberta, bbox, zoom mínimo |
| `GET /grelha/tiles/:z/:x/:y` | Tile vetorial (MVT, camada `grelha`); 204 se vazio ou zoom < 10 |
| `GET /camadas` | Catálogo das camadas de dados, com fonte, licença e anos |

## Testes

```bash
cd api && node ace test                       # precisa de .env.test com uma BD *_test
cd pipeline && python -m pytest               # teste de carga: TEST_DATABASE_URL=...observatorio_test,
                                              # com as migrações aplicadas (NODE_ENV=test node ace migration:run)
cd web && npm test                            # sem ecrã: npx ng test --browsers=ChromeHeadlessCI --watch=false
```

## Mapa de base

O site usa o estilo `positron` do [OpenFreeMap](https://openfreemap.org/) (gratuito, sem chave,
dados © OpenStreetMap). Se não carregar, o mapa mostra os dados sobre um fundo liso.
Configurável em `web/src/environments/`.

## Fontes de dados e licenças

Ver o catálogo em `GET /api/v1/camadas` e o documento do projeto. Os dados do INE são de
reprodução autorizada exceto para fins comerciais; o Google Earth Engine é usado no nível
não comercial. Se o projeto alguma vez gerar receita, estas condições têm de ser revistas.
