# EME Cost Analysis

Data de referencia: 2026-07-30

## Base de pricing

- OpenAI `gpt-5-mini`: input USD 0.25 / 1M tokens, cached input USD 0.025 / 1M, output USD 2.00 / 1M.
- OpenAI `gpt-image-1`: text input USD 5 / 1M, image output USD 40 / 1M.
- Luma `uni-1`: preview de imagem usado como referencia para previas do Studio IA.
- Luma `ray-3.2`: USD 0.30 por video de 5s e USD 0.90 por video longo.
- Cambio adotado no estudo: 1 USD = BRL 5.1005.

## Leitura critica

- O custo operacional do EME e muito baixo em texto e moderado em imagem.
- O unico bloco realmente sensivel para margem e video.
- COS, importacao IA e campanhas textuais permitem margem alta mesmo com franquias generosas.
- O desenho de planos deve usar videos e campanhas como principal mecanismo de expansao de ticket, e nao conversas simples do COS.

## Operacoes com maior impacto de custo

1. `studio.video.final`
2. `studio.video.preview`
3. `studio.construction_image`
4. `studio.instagram`
5. `property.import_image`

## Diretriz de margem

- Free deve ser limitado por creditos, nao por conversa.
- Pro deve ser o plano mais simples de vender.
- Growth deve absorver uso serio de Studio IA.
- Scale deve existir para proteger margem em operacoes com alto volume e video recorrente.
