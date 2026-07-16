"""
Testa a cobertura do Overture Maps pra um nicho + cidade específicos.
Roda LOCALMENTE (precisa de internet livre, sem restrição de domínio).

Uso:
    py testar_overture.py

Ajuste as variáveis BBOX e FILTRO_TEXTO abaixo antes de rodar, se quiser
testar outra cidade além de Atlanta.
"""

import duckdb

# --- CONFIGURAÇÃO ---
# Bounding box (min_lon, min_lat, max_lon, max_lat) da cidade que você quer testar.
# Exemplo abaixo: Atlanta, GA (área ampla). Pegue o bbox real da sua cidade em bboxfinder.com
BBOX = {
    "min_lon": -48.72,
    "min_lat": -27.55,
    "max_lon": -48.58,
    "max_lat": -27.42,
}

# --- SCRIPT ---
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
con.execute("INSTALL spatial; LOAD spatial;")
con.execute("SET s3_region='us-west-2';")

# Release atual do Overture (atualizado mensalmente).
# Se esse link parar de funcionar no futuro, confira a versão mais nova em:
# https://docs.overturemaps.org/release-calendar/
RELEASE = "2026-06-17.0"

query = f"""
SELECT
    names.primary AS nome,
    categories.primary AS categoria,
    addresses[1].freeform AS endereco,
    addresses[1].locality AS cidade,
    addresses[1].region AS estado,
    websites[1] AS site,
    phones[1] AS telefone,
    ST_X(geometry) AS longitude,
    ST_Y(geometry) AS latitude
FROM read_parquet(
    's3://overturemaps-us-west-2/release/{RELEASE}/theme=places/type=place/*',
    filename=true,
    hive_partitioning=1
)
WHERE bbox.xmin BETWEEN {BBOX['min_lon']} AND {BBOX['max_lon']}
  AND bbox.ymin BETWEEN {BBOX['min_lat']} AND {BBOX['max_lat']}
  AND (
      -- Categorias de imobiliária no Overture
      categories.primary IN (
          'real_estate_agent',
          'real_estate',
          'property_management'
      )
      -- OU nome contém palavras-chave do nicho, como reforço
      OR (
          lower(names.primary) LIKE '%imobiliaria%'
          OR lower(names.primary) LIKE '%imobiliária%'
          OR lower(names.primary) LIKE '%imoveis%'
          OR lower(names.primary) LIKE '%imóveis%'
      )
  )
LIMIT 200;
"""

print("Consultando Overture Maps (pode levar 30-90s na primeira vez)...\n")
resultado = con.execute(query).fetchdf()

print(f"Total de negócios encontrados: {len(resultado)}\n")
print(resultado[["nome", "categoria", "endereco", "cidade", "site", "telefone"]].to_string())

# Salva em CSV pra você comparar manualmente com o Google Maps
resultado.to_csv("overture_teste_resultado.csv", index=False)
print("\nSalvo em overture_teste_resultado.csv — compare esses nomes com uma busca real no Google Maps.")
