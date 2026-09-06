# Landing EME — versão local de revisão (06/09/2026)

## Escopo e preservação

Versão commitada localmente, sem push ou deploy. Nenhuma alteração de dados, contas, créditos, planos, Auth, APIs ou módulos internos.

O estado inicial está registrado em `.qa-audit-tmp/six-card-landing/baseline.patch`, com cópia separada de `hero-material.module.css`, que já existia como arquivo não rastreado. A comparação de preservação está em `preservation.json`, na mesma pasta.

Já existiam e foram preservados: springs desktop 42/24/1.05 e mobile 60/25/0.9, normalização de wheel, arraste, projeção de inércia, controle de tempo/aba oculta, acabamento do logo e correção de hit-testing dos planos 3D. O diff completo contra HEAD inclui essas alterações anteriores; ele não representa somente esta entrega.

Auth, CSS global, teste mobile de Auth, `module-card.tsx` e `next-env.d.ts` mantêm exatamente seus diffs de entrada. Arquivos de limpeza de contas e materiais não rastreados de missões anteriores não foram modificados. Nenhum arquivo antigo de teste foi reescrito.

## Implementação

- Seis cards igualmente espaçados, sem Marketplace fixo nem card exclusivo do COS.
- Primeira leitura permanente com categoria, promessa e explicação solicitadas.
- COS como menção secundária, com explicação acessível de ações delimitadas.
- Acelerador retirado do percurso principal; permanecem apenas informações secundárias de desenvolvimento. Percentuais e oferta dos “100 primeiros” retirados do componente comercial.
- Superfícies brancas, verde discreto, Geist existente, Lucide, bordas e relevos suaves.
- Logo 3D e cenário mantidos. Não foram produzidos ou substituídos assets da marca.
- Opacidade do card inteiro derivada continuamente da profundidade: `0.16 + 0.84 × smoothstep(depth)`. O brilho varia de 0.78 a 1 na mesma curva. Funciona nos dois sentidos; os cards permanecem discretamente visíveis atrás do logo. Hit-testing desativado abaixo de 0.42 de profundidade.
- Foco por teclado traz o card ao primeiro plano pela menor rotação, sem aguardar um ciclo da órbita. Autorrotação pausa durante o foco por teclado e modais.
- Raio mobile contido na largura útil; redução vertical/escala apenas em janelas baixas. Parâmetros físicos de scroll, spring, arraste e inércia não foram substituídos.
- Corrigido o handler global de wheel que cancelava a rolagem interna dos modais.

## Modais

Todos os seis usam `LandingModalShell` com a mesma apresentação. Texto e controles são HTML real, não imagens de modal. Composição desktop texto/esquerda e demonstração/direita; mobile título e explicação, demonstração e capacidades em fluxo vertical.

Os exemplos são representações editoriais dos campos existentes, explicitamente identificados como ilustrativos; **não são capturas do ambiente autenticado**. Não há dados pessoais nem controles de produto falsamente executáveis. A prévia de imóvel utiliza a foto existente `property-living.png`; as informações de exemplo permanecem consistentes entre Imóveis, Catálogo, documentos e valor da carteira.

Catálogo/Marketplace e Propostas/Contratos possuem opções internas com semântica de tabs, setas, Home/End, relação com tabpanel e espaço reservado para reduzir mudanças de altura.

Fechamento único de 44×44 px, contraste e foco visíveis, Escape, backdrop, contenção de foco, restauração do foco, bloqueio da rolagem de fundo e `inert` no restante da página. O X permanece fora da área que rola. Safe areas e limites de viewport são respeitados.

## Evidências de produto consultadas (somente leitura)

| Apresentação | Evidência | Limite comunicado |
| --- | --- | --- |
| Clientes e agenda | Cadastro/estados em componentes de clientes; `app/api/brokers/agenda/route.ts` persiste e consulta eventos, tarefas, datas e horários | Não há promessa de vínculo automático, sincronização externa ou lembrete automático |
| Imóveis | `app/api/properties/import/ad/confirm/route.ts`; `lib/property-publication-readiness.ts`; rotas `[id]/publish` e `[id]/marketplace` | Rascunho distinto de publicação; dados/fotos e CRECI cadastral exigidos por canal |
| Catálogo e Marketplace | `lib/eme-plans.ts`; enforcement na rota de publicação; páginas `/imoveis/busca` e `/imoveis/comparar`; catálogo público existente | Publicação Marketplace nos planos Pro/Scale; nenhuma garantia de tráfego, contatos, conversão ou segurança da transação |
| Studio IA | `components/broker-studio-ia-prepare-property-page.tsx` compara original/resultado e aprova o asset na Biblioteca; rota `app/api/studio-ia/prepare-property/route.ts` possui execução de provedores e persistência | Créditos, revisão humana, alteração virtual distinta do estado real; criação não equivale a publicação ou mídia paga |
| Propostas e contratos | Componentes de propostas/documentos e contratos; `app/api/brokers/contract-instances/[id]/pdf/route.ts` gera rascunho ou exige completude para PDF final | Sem prazo absoluto, envio automático, assinatura concluída ou análise jurídica prometida |
| Financeiro | `lib/broker-finance.ts` agrega lançamentos, comissões e pagamentos de locações; `app/api/brokers/financial/route.ts` | Recebido/previsto/atrasado; carteira não é receita; contas manuais, sem integração bancária |
| COS | `lib/cos-launch/queries.ts`, `actions.ts` e handlers limitados por capacidade | Consultas e formulários para revisão/confirmação, não execução universal/autônoma |

Foram inspecionadas também as capturas existentes em `public/screens`. Capturas com dados pessoais ou copy inadequada não foram reutilizadas. A validação das operações autenticadas foi por código de UI e handlers; não foram criados imóveis, clientes, documentos, transações ou gerações de IA para esta missão.

## QA

- Chromium: seis modais e as duas opções de cada grupo em 1440×900, 390×844, 375×812 e 768×1024.
- WebKit 26.5: seis modais e opções internas em 390×844.
- Reflow equivalente à área útil de zoom 200%: 720×450. A inspeção visual detectou corte no card frontal; o ajuste para baixa altura foi aplicado e a rodada repetida, incluindo limites completos da hitbox.
- X único, mínimo 44 px; Escape; Tab/Shift+Tab; retorno de foco; fundo inerte; foco visível; scroll interno até o final; ausência de overflow horizontal no conteúdo.
- Nenhum erro de console nas rodadas de QA dos modais.
- Catálogo real de Fabrício e Marketplace retornaram HTTP 200; links abrem em nova aba com `noopener noreferrer` e indicação acessível.
- Quatro testes em `tests/e2e/landing-six-modules.spec.ts` passaram: volta desktop com hover/cliques em todos os cards, sentido inverso, cursor sob reduced motion, arraste/tap mobile, e opacidade/hit-testing amostrados durante mudanças de profundidade.
- Houve um timeout na primeira rodada do arraste mobile. A repetição isolada e a rodada final completa passaram. Não foi mascarado por cliques sintéticos.
- ESLint direcionado aos arquivos desta tarefa: passou.
- `npm run build`: passou, incluindo checagem TypeScript e geração de 106 páginas estáticas.
- `npm run lint`: 26 erros preexistentes fora do escopo (1 em billing, 25 no script não rastreado de limpeza de contas).
- `npx tsc --noEmit --incremental false`: oito TS5097 em imports com extensão `.ts` de testes anteriores. Não foram modificados configuração ou testes alheios para mascará-los.
- `git diff --check`: sem erros.

## Imagens, performance e acessibilidade

Nenhuma biblioteca ou imagem nova foi adicionada. As artes promocionais completas deixam de ser utilizadas. As duas imagens de demonstração existentes são carregadas somente quando seu modal é montado, com dimensões reservadas, lazy loading e reaproveitamento do mesmo URL. Os PNGs têm cerca de 1,6 MB e 1,2 MB; não se afirma melhoria quantitativa de Lighthouse sem medição controlada. A otimização global de imagens está desabilitada no projeto e não foi alterada.

Opacity/transform continuam atualizados por MotionValue, sem renderização React por frame. Não há blur animado nos cards; a opacidade afeta toda a composição. O blur do backdrop é moderado e estático.

Semântica e foco foram testados no navegador. Isso não substitui uma sessão manual de VoiceOver nem teste em iPhone físico/PWA instalado.

## Pendências explícitas

1. Produzir/aprovar um par real, sem dados pessoais, de original e resultado revisado do Studio. Os assets existentes não comprovam esse par; não foi inventado um antes/depois. A apresentação atual mostra a entrada e o fluxo de revisão, com aviso explícito.
2. Opcionalmente substituir as representações editoriais por recortes atuais, anonimizados, do ambiente autenticado após aprovação dos dados de demonstração.
3. QA manual com VoiceOver/iPhone físico e cache de PWA instalado.
4. Testes antigos que pressupõem dez cards ou modais feitos de imagens não representam mais esta apresentação. Foram preservados; esta entrega acrescenta uma suíte específica para os seis cards.
5. Corrigir os erros globais de lint/TypeScript em tarefa separada, sem misturar com a landing.

## Arquivos desta entrega

Alterados: `lib/eme-modules.ts`; `components/eme/eme-landing-scene.tsx`; `eme-mobile-experience.tsx`; `orbit-stage.tsx`; `mobile-orbit-stage.tsx`; `expanded-module-panel.tsx`; `landing-modal-shell.tsx`; `landing-modal-shell.module.css`; `landing-accelerator.tsx`; `hero-material.module.css` (já não rastreado na entrada).

Novos: `lib/eme-orbit-presentation.ts`; `components/eme/landing-product-intro.tsx`; `landing-product-intro.module.css`; `module-presentation.module.css`; `tests/e2e/landing-six-modules.spec.ts`; este relatório.

Artefatos locais de validação: `.qa-audit-tmp/six-card-landing/` (ignorado pelo Git). Capturas finais: `desktop-landing.png`, `desktop-imoveis.png`, `webkit-mobile-landing.png`, `webkit-mobile-imoveis.png` e arquivos equivalentes para os outros modais, opções, tablet e reflow. Os relatórios JSON registram dimensões, carregamento de imagens, foco e console.
