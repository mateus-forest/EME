# Checklist de Teste Real do MVP EME

## Corretor Novo
- Criar conta de corretor individual.
- Confirmar redirecionamento para o portal do corretor.
- Validar que não há fluxo de imobiliária visível.

## Cadastro e Conta
- Editar dados básicos do corretor.
- Conferir WhatsApp, CRECI e informações do catálogo.
- Fazer logout e login novamente.

## Imóveis
- Criar imóvel manual com e sem imagem.
- Criar imóvel com IA em modo disponível ou validar mensagem amigável quando IA estiver desativada.
- Upload de imagem via Supabase Storage.
- Editar imóvel, publicar, despublicar e excluir.
- Anexar áudio ou validar orientação quando gravação local não estiver disponível.

## Catálogo Público
- Abrir `/catalogo/[slug]` sem login.
- Buscar imóvel.
- Abrir detalhes do imóvel.
- Compartilhar catálogo e imóvel.
- Clicar em WhatsApp.
- Enviar lead pelo formulário do catálogo.

## Leads
- Ver lead criado no portal.
- Abrir detalhes.
- Alterar status manualmente.
- Confirmar vínculo com imóvel quando houver.

## Analytics
- Conferir visualizações reais do catálogo.
- Conferir visualizações de imóvel.
- Conferir cliques no WhatsApp.
- Filtrar por período, imóvel, origem e busca.
- Validar estado vazio sem mocks.

## Financeiro
- Conferir valor total da carteira.
- Alterar percentual de comissão.
- Filtrar por status e tipo.
- Alternar Geral e Por imóvel.
- Salvar configuração e recarregar a página.

## Assessor EME
- Conferir número oficial vindo do admin quando configurado.
- Enviar mensagem ao assistente.
- Validar créditos usados e restantes.
- Conferir histórico recente e ação executada.
- Validar mensagem amigável sem IA ativa.

## Corretor EME
- Salvar configuração do WhatsApp do corretor.
- Solicitar ativação.
- Enviar mensagem interna de teste para `/api/corretor-eme/message`.
- Confirmar criação/atualização de lead por telefone.
- Confirmar intenção detectada e histórico salvo.

## Plano
- Ver plano atual sem plano fake.
- Acionar Assinar plano.
- Solicitar extra.
- Falar com suporte.
- Conferir notificação criada para solicitações comerciais.

## Admin
- Ver dashboard agregado.
- Ver corretores.
- Salvar configuração do Assessor EME.
- Conferir Corretor EME por corretor.
- Conferir consumo IA, custos, assinaturas, receita e analytics sem dados fake.
