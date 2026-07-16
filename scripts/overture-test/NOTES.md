# Validação do Overture Maps como fonte de dados

## Objetivo
Testar se o Overture Maps (dataset aberto e gratuito de POIs) pode substituir
o Google Places API como fonte primária de descoberta de leads, reduzindo o
custo variável por lead do maisLEAD.

## Método
Rodado localmente via DuckDB + httpfs, lendo os arquivos GeoParquet do
Overture Maps direto do S3 (release mensal). Buscado por bounding box da
cidade + filtro de categoria (categories.primary) e texto no nome como
reforço. Resultado comparado manualmente com uma busca real no Google Maps
para o mesmo nicho e cidade.

## Resultados

### Atlanta, GA (EUA) — nicho: granito/mármore/quartzo
- Categorias usadas: granite_supplier, countertop_installation, stone_supplier,
  tile_store, masonry_concrete, cabinet_sales_service, kitchen_remodeling
- Recall: ~80-90% dos negócios reais do Google Maps apareceram no Overture
  (16-18 de 20 testados)
- Ruído: quase zero após filtrar por categoria (antes, com filtro de texto
  livre, vinha muito ruído: igrejas, parques, restaurantes)
- Validação extra: o cliente real ATM Granite and Marble apareceu
  corretamente no dataset, com telefone e site batendo
- Observação: alguns negócios "ausentes" na verdade tinham mudado de nome
  mas o endereço batia (ex: "All Installations Granite" no Overture =
  "Infinity Granite & Countertops" no Google atualmente) — sinal de dado
  levemente desatualizado em nome, não em localização

### Biguaçu, SC (Brasil) — nicho: imobiliária
- Categorias usadas: real_estate_agent, real_estate, property_management
- Recall: ~78% dos negócios reais do Google Maps apareceram no Overture
  (14 de 18 testados)
- Achado importante: o Overture trouxe MUITO mais leads (62 no total) do que
  os ~20 visíveis na busca do Google Maps — inclui corretores autônomos e
  imobiliárias pequenas que não aparecem facilmente numa busca manual

## Decisão
O Overture Maps vira a fonte PRIMÁRIA de descoberta de leads no maisLEAD,
substituindo o uso direto do Google Places API para busca inicial.

O Google Places API entra apenas como:
1. Fallback pontual para cidades/nichos onde a cobertura do Overture for fraca
2. Enriquecimento sob demanda (rating, reviews, horário) quando o cliente
   clicar para ver esses dados de um lead específico — não em todos os leads
   da cota automaticamente

Isso reduz o custo variável por lead de forma expressiva, porque o Overture
é gratuito e o Places API só é chamado quando realmente necessário, não em
toda busca.

## Próximos passos
- [ ] Desenhar schema no Supabase: tabela leads_base (dados do Overture) e
      leads_enrichment (dados pagos, sob demanda)
- [ ] Escrever script de importação do Overture pro Supabase, por
      nicho + cidade prioritários
- [ ] Trocar a lógica de busca do app: consultar leads_base primeiro,
      cair pro Places API só se a cobertura for insuficiente
- [ ] Implementar botão de "enriquecer" por lead (rating/reviews sob demanda)
- [ ] Testar em mais 1-2 cidades (uma menor nos EUA, uma capital no Brasil)
      antes de considerar validação completa
