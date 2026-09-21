# Parceiros EME

Área adicionada ao portal atual em `/corretor/parceiros`, no menu lateral **Operação → Parceiros EME**. Não retoma o redesenho nem habilita BROKER_PORTAL_V2.

## Escopo entregue

- Visão geral com indicadores derivados das indicações do corretor autenticado.
- Registro de nome, e-mail, telefone opcional, empresa, modalidade, acessos, observações, próxima ação e data de retorno. Exige declaração de autorização para registrar o contato.
- Etapas: registrada, contato realizado, demonstração, em negociação, encaminhada ao EME, adesão informada e encerrada.
- Histórico atômico de atualizações, preferência de não contato, proteção contra duplicidade/repetição e edição concorrente.
- Paginação em lotes de 20; até 30 atividades recentes por registro na interface, com todo o histórico preservado no banco.
- Simulação de comissão e tabela de referência com preços, prazo, extras, modelos para imobiliárias e possibilidades de evolução.
- Mensagem inicial copiável e cópia da tabela; nenhuma mensagem enviada automaticamente.

Os registros são privados por Broker, inclusive entre corretores da mesma imobiliária. O autor vem da sessão; a API não aceita brokerId, status financeiro ou valor de comissão enviados pelo cliente. E-mail único por corretor, normalizado em minúsculas. Duplicidade comercial entre parceiros exige avaliação posterior: esta área não reserva atribuição ou verifica se a pessoa já é assinante.

## Condições representadas

Comissão proposta de **20% para todas as modalidades**, por **12 meses**, a partir do primeiro pagamento elegível confirmado. Incide no valor recebido após descontos, sem estornos, reembolsos ou extras. Sem comissão sobre compra própria, indicação em cadeia ou dupla comissão sobre a mesma receita.

| Modalidade | Preço mensal | Comissão mensal estimada |
| --- | --- | --- |
| Pro individual | R$ 129 | R$ 25,80 |
| Scale individual | R$ 389 | R$ 77,80 |
| Conveniada, meses 1–3 | R$ 119 | R$ 23,80 |
| Conveniada, meses 4–12 | R$ 129 | R$ 25,80 |
| Equipe 3–4 | R$ 119/acesso | R$ 23,80/acesso |
| Equipe 5–9 | R$ 109/acesso | R$ 21,80/acesso |
| Equipe 10+ | R$ 99/acesso | R$ 19,80/acesso |

Equipe com dez acessos: R$ 990/mês, comissão de R$ 198/mês. Preço especial proposto por seis meses; preço nos meses 7–12 não definido. Por isso o simulador de equipe soma somente os seis meses com preço proposto conhecido. A comissão continua com prazo de 12 meses se houver pagamentos elegíveis, mas não há projeção inventada do preço renovado. No convênio, a projeção soma corretamente três meses promocionais e nove regulares (R$ 303,60 por conta).

Planos individuais e extras foram transcritos da referência fornecida pelo usuário. Equipes e convênio aparecem como propostas sujeitas à aprovação comercial. Não são novos Prices Stripe ou descontos aplicados automaticamente. A tabela é uma referência comercial versionada em 21/09/2026, independente da resolução de billing.

Prorrogação, campanhas conjuntas e evolução da parceria dependem de avaliação de permanência, resultado, qualidade e novo acordo. Não existe promessa de renovação automática ou percentual maior.

## Limites explícitos

Não cria contas de indicados, não envia convites, não emite links de atribuição fictícios, não altera cadastro/login e não conecta automaticamente Stripe, comissões ou pagamentos. “Adesão informada” é declaração do parceiro, não assinatura confirmada. A interface mostra conciliação como indisponível, sem saldo fictício de R$ 0. Próxima ação é anotação operacional, sem calendário paralelo ou lembrete automático.

Gestão da imobiliária, validação administrativa de atribuição, vínculo com assinatura, demonstrativos financeiros e repasse são etapas futuras. A imobiliária está contemplada nas modalidades e cálculos desta seção, não em um novo portal de gestão.

## Banco e publicação

Migração aditiva: `20260921120000_add_partner_referrals`. Cria somente `PartnerReferral` e `PartnerReferralActivity`, com índices e chaves estrangeiras. Não altera dados de contas, planos, imóveis, clientes ou billing. O esquema Prisma ganha apenas esses modelos e a relação inversa no Broker.

Aplique e registre essa migração no destino correto antes de disponibilizar a persistência em produção. Não execute reset/db push ou todo o histórico pendente sem revisão; há uma limitação preexistente de baseline nas migrações antigas documentada em `docs/captacao.md`. Se o SQL for aplicado manualmente, registre depois `20260921120000_add_partner_referrals` com `prisma migrate resolve --applied`, somente após conferir o resultado e a conexão do ambiente. Nenhum procedimento de produção foi executado nesta entrega.

Sem a nova estrutura, as APIs retornam 503 e a interface informa indisponibilidade; simulador e colinha continuam utilizáveis. Reversão do código não requer apagar as duas novas tabelas.

## Validação local

Ambiente: PostgreSQL exclusivo em `127.0.0.1:55449/captacao_preview`, sem migração ou cópia de dados de produção. Testes de persistência geram somente registros identificados como FIXTURE; preservam as contas locais existentes.

```powershell
node tests/partners/domain.test.cjs
node tests/partners/route.test.cjs
$env:PARTNERS_TEST_ENV='C:/Users/mateu/Documents/eme-captacao/qa/.env.captacao-local'
$env:PARTNERS_TEST_ACCESS='C:/Users/mateu/Documents/eme-captacao/qa/access.json'
node tests/partners/local-check.cjs
$env:PARTNERS_QA_DIR='.qa-audit-tmp/partners-20260921'
node tests/partners/browser.cjs
node scripts/captacao-local.cjs build "$env:PARTNERS_TEST_ENV"
node scripts/captacao-local.cjs types "$env:PARTNERS_TEST_ENV"
```

O navegador de teste usa autenticação e persistência reais locais. Apenas o cenário de indisponibilidade de armazenamento é interceptado para simular 503. Não há teste de pagamento ou transferência real, pois estão fora desta etapa. Autorização de ADMIN/AGENCY é testada com sessão substituída no teste unitário; o isolamento entre dois BROKER é testado por HTTP e PostgreSQL reais.

### Resultados em 21/09/2026

- 9 testes unitários aprovados (5 de regras/cálculos e 4 de proteção/erros da API).
- 16 verificações HTTP/PostgreSQL aprovadas, incluindo autenticação, isolamento, repetição concorrente, duplicidade de e-mail, versão concorrente, histórico, UTC, não contato e paginação.
- Chromium: registro, atualização e persistência após reload; fechamento por Escape; simulador Pro/Scale/convênio/equipe; entrada inválida; desktop 1365 px e mobile 320/390/430 px; rolagem da tabela e dos modais; navegação para Captação e Conta; erro 503 simulado explicitamente. Zero erros não tratados de página. Safari/iPhone físico não testado.
- Build Next completo com TypeScript aprovado após os ajustes finais. Lint dos arquivos de produto alterados aprovado.
- Corrigidos nesta implementação: nomes acessíveis dos seletores e altura das abas quando quebradas em duas linhas no celular. O teste do histórico foi ajustado para considerar a data presente no mesmo elemento; não houve alteração de regra para fazê-lo passar.
- Limitações locais preexistentes: dependências ausentes em node_modules e cache Next inválido. Dependências restauradas a partir do lockfile, sem alteração de package.json/lockfile; cache anterior preservado em QA. Um servidor já aberto na porta 3000 foi mantido.

Prévia desta entrega: `http://localhost:3116/corretor/parceiros`, servindo o build compilado com banco local e serviços externos desligados. A conta de teste existente foi preservada; acesso em `C:/Users/mateu/Documents/eme-captacao/qa/ACESSO-LOCAL.txt`. Os registros FIXTURE visíveis são dados sintéticos de QA, não indicações comerciais reais.

O iniciador temporário da prévia compilada fica em `.qa-audit-tmp/partners-20260921/start-compiled.cjs` (ignorado pelo Git). Ela não recarrega alterações do código automaticamente. Para desenvolvimento, o iniciador local existente pode ser utilizado quando não houver outro `next dev` aberto na mesma pasta. Capturas e logs ficam na mesma pasta QA e não integram o commit.

O SQL aditivo foi executado em transação somente no banco local. Esse banco de QA, inicializado por schema antes desta entrega, não possui `_prisma_migrations`; seu baseline não foi alterado. Contagens preservadas durante a aplicação: 2 usuários, 2 corretores, 2 imóveis, 3 clientes, 0 assinaturas, 5 captações de imóveis e 2 eventos de agenda. Os testes seguintes também confirmaram preservação dessas contagens.
