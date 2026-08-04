# Financeiro

## Objetivo

Exibir uma visão estimada da carteira com base nos imóveis cadastrados e na comissão configurada.

## Principais funções

- calcular valor total da carteira;
- mostrar ticket médio;
- mostrar comissão potencial total, média, maior e menor;
- filtrar por status, tipo, finalidade e base de cálculo;
- salvar configuração financeira.

## Fluxo de uso

1. Abra `Financeiro`.
2. Revise os indicadores principais.
3. Ajuste percentual de comissão e filtros.
4. Salve a configuração para manter a base desejada.

## Dicas

- revise o percentual antes de interpretar a comissão projetada;
- use filtros para separar carteira publicada e rascunhos;
- acompanhe imóveis sem valor informado, porque eles afetam a leitura da carteira.

## Limitações atuais

- os valores exibidos são estimativas com base no cadastro dos imóveis;
- a tela não representa fluxo contábil real, recebimentos ou conciliação financeira;
- imóveis sem preço ficam fora de algumas contas práticas.

## Mensagens de erro comuns

- `Não foi possível salvar a configuração.`
- `Sua carteira ainda está vazia` quando não há imóveis cadastrados.

## Melhores práticas

- mantenha preço dos imóveis preenchido;
- use a comissão padrão real da operação;
- combine esta leitura com `Desempenho` para entender valor e demanda juntos.
