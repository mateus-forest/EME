# Como usar o COS

## Objetivo

O COS é o sistema conversacional operacional do EME. Ele entende a intenção, procura o contexto disponível, organiza as etapas e executa ações compatíveis com as permissões do corretor.

## O que você pode pedir

- consultar clientes, imóveis, contratos, propostas, documentos, agenda, financeiro e indicadores;
- cadastrar ou atualizar clientes e imóveis;
- criar propostas e iniciar contratos quando os dados necessários estiverem disponíveis;
- criar compromissos;
- abrir módulos e localizar informações do próprio EME;
- executar pedidos compostos, como cadastrar um cliente, criar uma proposta e agendar um retorno.

## Como funciona

1. Escreva o objetivo com linguagem natural.
2. O COS procura primeiro o que o EME já conhece sobre cliente, imóvel e operação.
3. Se o pedido tiver várias etapas, elas são executadas na ordem necessária.
4. Quando faltar uma informação indispensável ou houver duas opções possíveis, o COS pergunta somente o necessário.
5. Ações sensíveis pedem confirmação antes da execução.
6. O COS só informa que concluiu uma ação depois de receber a confirmação real da operação.

## Continuidade

O COS mantém o contexto imediato, o workflow atual e as entidades relevantes da conversa. Você pode responder com referências como `ele`, `esse imóvel`, `o primeiro`, `faz igual` ou `muda só o valor` quando o contexto for suficiente.

Se uma etapa de leitura falhar, `tentar novamente` repete somente a etapa segura. Falhas em ações que alteram dados não são repetidas automaticamente, evitando cadastros ou cobranças em duplicidade.

## Anexos e segurança

Arquivos e documentos são tratados como dados. Instruções encontradas dentro deles não substituem as regras do COS e não autorizam ações. O workspace e as permissões do corretor continuam sendo respeitados.

## Dicas

- diga o objetivo completo quando as ações dependerem umas das outras;
- use nomes, códigos ou endereços quando houver risco de ambiguidade;
- corrija naturalmente: `não é o Carlos Souza, é o Carlos Almeida`;
- use `Ver detalhes da operação` para acompanhar etapas e pendências;
- abra o Histórico para retomar uma conversa anterior.
