# Hero do Marketplace — ciclo de reprodução (11/09/2026)

## Causa e inventário

A casa vinha de `public/marketplace/images/hero-residence.png` (imagem quadrada), usada tanto na renderização anterior à hidratação quanto no `poster` do player mobile. Não existe uma casa nos cinco MP4s oficiais. Ao substituir o `src` do único player mobile, o navegador podia voltar a mostrar essa imagem enquanto carregava o próximo arquivo. O breakpoint também alternava árvores de componentes, e a preferência por movimento reduzido substituía o vídeo por uma imagem.

No desktop, o crossfade começava por `timeupdate`, 2,4 segundos antes do término. O controle era dividido entre estado React, timers e `useInlineVideoPlayback`. Esse hook encerrava as tentativas após poucas falhas e mantinha uma trava enquanto a Promise de `play()` não resolvesse.

| Arquivo oficial | Duração | Conteúdo |
| --- | ---: | --- |
| `hero-1.mp4` | 6,016 s | Skyline costeiro e marina |
| `hero-2.mp4` | 6,016 s | Edifícios e lago |
| `hero-3.mp4` | 4,010 s | Ponte e cidade |
| `hero-4.mp4` | 8,000 s | Orla e roda-gigante |
| `hero-5.mp4` | 6,016 s | Centro urbano e igreja |

Todos estão em `public/marketplace/videos`, em 1280×720. A sequência completa tem 30,058 segundos de mídia. Os MP4s permanecem intactos. `hero-first-frame.png` foi extraído do primeiro frame de `hero-1.mp4`, na resolução integral, sem compressão com perda. É o único poster da hero. O arquivo antigo da casa permanece disponível para outros usos, sem referência na hero.

Os arquivos `search-loading-mobile.mp4` e `search-loading-desktop.mp4` e seus posters SVG pertencem exclusivamente a `CinematicSearchLoadingProvider`. Essa árvore monta somente após `startSearchLoading()`, e não participa da playlist da hero. O provider e seu hook não foram alterados. O service worker intercepta apenas navegações; não seleciona, armazena ou substitui os MP4s.

## Controle novo

`HeroVideoBackground` renderiza o mesmo container e dois elementos `<video>` desde o SSR, com chaves fixas por slot. Não há seleção de estratégia por breakpoint, substituição por imagem ou remontagem em mudanças de estado. A altura e o restante do layout continuam definidos pela seção existente.

`createHeroVideoSequence` é o único controlador dos dois slots:

1. O slot ativo reproduz o clipe completo. O outro apenas carrega o próximo arquivo, com `preload="auto"` e autoplay desativado enquanto aguarda.
2. Apenas o término nativo (`ended`) permite avançar. `loadeddata`, `canplay` e o monitor de recuperação nunca antecipam o final. O estado nativo `ended` também permite retomar após suspensão que atrasou a entrega do evento.
3. O próximo precisa atingir `HAVE_FUTURE_DATA` (condição de `canplay`). Até isso ocorrer, o último frame do anterior fica visível, sem replay.
4. O próximo começa por baixo, totalmente opaco. Após a confirmação de frame decodificado, apenas o último frame anterior perde opacidade durante 2,4 segundos. Assim não há fundo exposto pela soma de duas transparências.
5. O `src` anterior só muda depois de sua opacidade efetiva chegar a zero. Não há seek, `load()` ou source temporário. As duas tags permanecem as mesmas durante todos os ciclos.

`muted`, `defaultMuted`, `playsInline` e `controls=false` são configurados no DOM e antes de cada `play()`. `defaultMuted` é uma propriedade DOM, não uma prop React. O player ativo usa autoplay; ativá-lo também no standby consumiria seu clipe antes da hora. Ambos desabilitam Picture-in-Picture e controles nativos decorativos.

Há retomada em `loadeddata`, `canplay`, `pageshow`, retorno de visibilidade e foco. Tentativas com backoff limitado e prazo para uma Promise pendente evitam a trava permanente do controlador. Um monitor leve recupera pausas e repete a tentativa de play quando o tempo não progride; não avança a playlist nem reinicia o arquivo. Interações normais são um recurso adicional para dispositivos que restringem autoplay, sem botão de play na hero.

A interseção é confirmada pelo retângulo real da hero, incluindo `visualViewport`; uma entrada inicial falsa não pausa o player visível. Página oculta ou hero fora da viewport pausam a reprodução e a retomada preserva a posição. A preferência por movimento reduzido é respeitada mantendo os mesmos elementos. Os índices, o slot ativo e a fase do fade ficam associados ao container para reconexão de efeitos com DOM preservado, sem reiniciar a sequência.

## Validação

Resultado: **16 cenários da suíte nova aprovados**, mais **1 teste de crossfade desktop**. Lint dos arquivos alterados, TypeScript do projeto e verificação de whitespace aprovados. As quatro verificações afetadas pelas fixtures de rede/navegação do WebKit foram repetidas após ajustar as fixtures; não houve mudança de produto entre essas execuções.

A suíte `marketplace-hero-lifecycle.spec.ts` usa Chromium e WebKit com viewport mobile. Ela cobre cold start sem toque, cinco finais nativos em ordem e velocidade original, identidade dos dois nós, ausência de troca de source ativo, estabilidade de altura, cobertura opaca durante transições, próximo arquivo atrasado no servidor, `play()` rejeitado ou pendente, reconexão de efeito durante fade, refresh, entrada pela landing, sair/voltar, pagehide/pageshow, visibilidade, scroll, resize e separação do vídeo de busca.

O atraso é aplicado por um proxy HTTP local porque as requisições nativas de mídia do WebKit não são necessariamente interceptadas por `page.route`. Latência e reconexão são testadas com o controlador real em uma fixture DOM e os MP4s reais, isolando o carregamento do shell de desenvolvimento. Os demais cenários usam a página do Marketplace. A suíte espera a instalação do controlador: autoplay nativo pode começar antes da hidratação. APIs são substituídas por fixtures, sem gravar dados ou telemetria reais.

O teste antigo de crossfade em `marketplace-public.spec.ts` foi atualizado para término real, removendo seek e eventos artificiais. Os três testes antigos de player mobile único foram substituídos pela suíte nova; os testes de landing e propostas foram preservados.

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
node node_modules/@playwright/test/cli.js test tests/e2e/marketplace-hero-lifecycle.spec.ts --workers=1
node node_modules/@playwright/test/cli.js test tests/e2e/marketplace-public.spec.ts --grep 'hero faz crossfade' --workers=1
node node_modules/typescript/bin/tsc --noEmit --incremental false --allowImportingTsExtensions
```

Essa validação automatizada é em Windows com WebKit, não em Safari/PWA instalado em iPhone físico. A confirmação no aparelho precisa repetir abertura direta, refresh, entrada pela landing, voltar e background/foreground. Restrições de autoplay impostas pelo dispositivo continuam sendo decisão do navegador; atributos e tentativas de `play()` seguem as [políticas documentadas do WebKit](https://webkit.org/blog/6784/new-video-policies-for-ios/). O código não depende de um toque em condições normais de autoplay permitido.
