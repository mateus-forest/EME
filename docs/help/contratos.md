# Contratos

## Objetivo

Gerar, anexar, revisar e acompanhar contratos dentro do workspace documental do corretor.

## Principais funções

- listar contratos por status;
- pesquisar contratos;
- criar contrato a partir de cliente e imóvel;
- anexar contrato externo em PDF, DOC ou DOCX;
- visualizar preview A4;
- atualizar status;
- abrir arquivo anexado;
- baixar arquivo;
- aprovar e revisar blocos do documento;
- usar o workspace de pendências por entidade.

## Fluxo de uso

1. Abra `Contratos`.
2. Escolha entre gerar um contrato novo ou anexar um contrato externo.
3. Vincule cliente, imóvel e tipo de contrato.
4. Preencha dados comerciais e revise o preview.
5. Corrija pendências nas entidades de origem quando necessário.
6. Salve o contrato e acompanhe o status.

## Dicas

- preencha bem cliente e imóvel antes de gerar contrato;
- use o painel de pendências para corrigir falta de dados na origem, não no texto final;
- anexe contratos externos quando o documento já existir fora do EME.

## Limitações atuais

- o preview elimina placeholders técnicos e depende das entidades de origem estarem completas;
- há blocos do workspace que o próprio sistema marca como futuros para apoio adicional do COS;
- contratos anexados usam a mesma biblioteca, mas seguem como documentos externos.

## Mensagens de erro comuns

- `Não foi possível carregar o contrato.`
- `Não foi possível salvar o contrato.`
- `Não foi possível anexar o contrato.`
- `Não foi possível atualizar o contrato.`

## Melhores práticas

- mantenha cliente e imóvel completos antes da minuta;
- valide datas, comissão e condições comerciais antes de salvar;
- use anexação externa só quando o documento já estiver pronto fora do fluxo interno.
