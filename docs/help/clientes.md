# Clientes

## Objetivo

Centralizar o cadastro, a edição, o acompanhamento e a exclusão de clientes da carteira do corretor.

## Principais funções

- listar clientes;
- buscar por nome, telefone, WhatsApp, imóvel, mensagem e CPF/CNPJ;
- filtrar por estágio do funil;
- cadastrar novo cliente;
- editar dados pessoais, jurídicos e documentos;
- atualizar status do cliente;
- excluir cliente;
- consultar pendências do cadastro;
- vincular imóvel de interesse.

## Fluxo de uso

1. Abra `Clientes`.
2. Use a busca ou os filtros do funil.
3. Clique em `Novo cliente` para abrir o cadastro.
4. Preencha identificação, contato, endereço, dados jurídicos e documentos.
5. Salve o cliente e acompanhe o feedback em toast no topo da tela.
6. Para revisar um cliente, abra seu detalhe e use `Salvar cliente`.
7. Para remover, use `Excluir cliente` e confirme a ação.

## Dicas

- use `Buscar CEP` para preencher endereço com mais rapidez;
- anexe RG, CPF, CNH, procuração ou outros documentos já no cadastro;
- vincule o imóvel de interesse para facilitar propostas e contratos depois;
- acompanhe o card de pendências para completar campos que ainda faltam.

## Limitações atuais

- a classificação de `Visita agendada` é inferida por palavras no conteúdo do cliente;
- o envio de documentos usa leitura local do arquivo e depois salva no fluxo do cliente;
- a rota `Leads` hoje redireciona para `Clientes`.

## Mensagens de erro comuns

- `Não foi possível carregar seus clientes.`
- `Não foi possível cadastrar o cliente.`
- `Não foi possível excluir o cliente.`
- `Não foi possível salvar o cliente.`
- `Não foi possível localizar o CEP.`
- `Não foi possível remover o documento.`

## Melhores práticas

- mantenha RG, CPF/CNPJ, estado civil e endereço preenchidos;
- revise o status do cliente conforme o avanço do atendimento;
- complete documentos cedo para reduzir pendências em contratos.
