# Regressões mobile / Portal — 10/09/2026

## 1. Vídeo do Marketplace

**Causa identificada no controle de playback:** a hero usava dois players para crossfade, iniciando o próximo com opacidade zero e reciclando o player anterior por timer. O próximo player ainda estava desativado no hook de reprodução durante a tentativa inicial. Se `play()` falhasse, a lógica voltava a chamar `play()` no anterior; em um vídeo já terminado isso reinicia o clipe. Readiness, pausa, source e troca de slot ficavam sob controles concorrentes, sensíveis ao ciclo de vida/autoplay mobile. O diagnóstico com rejeição transitória registrou repetição do primeiro clipe e tentativas de playback em slots sem source preparado.

**Correção:** mobile usa um único elemento de vídeo persistente e visível. O source muda somente no `ended` real, percorrendo hero-1 até hero-5 e reiniciando a sequência. Não há seek, `load()`, timer de descarte ou player de entrada invisível nessa estratégia. `autoPlay`, `muted`, `defaultMuted`, `playsInline` e `controls={false}` são configurados. Controles nativos decorativos são suprimidos apenas no player mobile.

O hook existente continua responsável por tentativas limitadas após falha transitória, metadata/canplay e retorno de visibilidade, foco ou pageshow. A observação de interseção mobile apenas solicita retomada quando o retângulo está visível; não pausa a reprodução por uma entrada obsoleta do observer. A transição de busca ainda pode pausar a hero enquanto a cobre, retomando do mesmo ponto depois. Preferência por movimento reduzido continua usando o poster.

O breakpoint é resolvido antes de montar a mídia, evitando baixar simultaneamente as duas estratégias. Desktop mantém o crossfade anterior. Nenhum MP4, poster, codec, resolução ou qualidade foi alterado. O service worker existente intercepta somente navegação e não armazena/intercepta os MP4s.

## 2. Escala da landing mobile

**Causa:** abaixo de 640px os cards tinham sido reduzidos para 82–100px e a marca para 43% da largura útil, antes de aplicar novamente o fator de encaixe geométrico. O ajuste vertical também usava a mesma extensão máxima para a parte traseira e a dianteira, apesar dos tamanhos diferentes dos cards.

**Correção:** base dos cards de 100–116px, tipografia/ícones proporcionais e marca de até 53% da largura útil. A trajetória reserva mais altura e mantém espaço nas laterais. O cálculo de encaixe usa extensões superior e inferior separadas, preserva a área de exclusão da marca e continua ancorando o logo à plataforma existente.

Medidas do logo em viewport de 844px de altura:

| Largura | Antes | Depois aproximado |
| --- | ---: | ---: |
| 375px | 147,5px | 167,8px |
| 390px | 153,9px | 175,6px |
| 393px | 155,2px | 177,1px |
| 430px | 165,5px | 191,3px |

A mudança de escala é exclusiva da geometria/CSS mobile. Nenhuma alteração em `OrbitStage` ou na composição desktop.

## 3. Acelerador EME

**Causa:** `acceleratorOpen` e `AcceleratorHero` continuavam presentes, mas nenhum controle na landing mobile alterava o estado para aberto. O rodapé exibia apenas a frase estática “Acelerador EME · Em desenvolvimento”.

**Correção:** essa identificação vira um botão compacto, mantendo o nome e o estado de desenvolvimento, com seta de acesso. Ele aciona a tela existente e o botão “Voltar ao EME” retorna à landing. Não foi criada nova rota, produto ou regra. A integração é opcional em `LandingCosInfo`, ativada apenas pela experiência mobile, preservando o desktop conforme o limite solicitado.

## 4. Preview da proposta

**Causas:** o iframe HTML tinha `pointer-events: none`, impossibilitando mouse/touch dentro do documento. O preview em texto não tinha limite vertical nem região própria de rolagem. Os containers do card ainda usavam `overflow-hidden`.

**Correção:** o preview tem limite `min(60dvh, 100dvh - 14rem)`, com fallback em vh, `overflow-y: auto`, contenção da rolagem e suporte a touch. O iframe recebe eventos e mantém a rolagem nativa de seu documento; um wrapper delimita sua área. O texto possui sua própria região rolável e focável. Foram removidos os `overflow-hidden` do card e do conteúdo do preview. Header e ações permanecem fora da área de rolagem do documento, acessíveis sem percorrer todo o texto. Nenhum conteúdo, cálculo, template, PDF ou ação de negócio foi modificado.

## Validação

- `tests/e2e/mobile-portal-regressions.spec.ts`: 15 cenários, incluindo as quatro larguras, ganho real de escala, abertura/volta do Acelerador, atributos de autoplay, primeira entrada, refresh, sair/voltar e lifecycle pageshow/pagehide.
- Playback real dos **cinco clipes completos**, em ordem, em Chromium e WebKit com emulação mobile. Verificados os eventos `ended` e `currentTime = duration`; sem acelerar, buscar o final ou simular o término. Mesmo elemento de vídeo durante todo o ciclo. Rejeição transitória de autoplay recuperada sem clique.
- Propostas HTML/texto curtas e longas, em 390px e 1440px. Mouse/wheel no desktop e gestos touch nativos repetidos no mobile até o último trecho; header, ações e largura do documento preservados. O teste isolou uma limitação do Chromium emulado: mouseWheel/synthesizeScrollGesture não movem um scroller após input touch, mesmo em HTML mínimo. Os testes mobile usam a sequência touch real, sem modificar scrollTop para forçar aprovação.
- `tests/e2e/landing-mobile-zones.spec.ts`: 17 cenários. Rotação completa, ausência de interseção com a marca e entre silhuetas arredondadas dos cards, continuidade, resize em 740/844/932px de altura, conteúdo íntegro e interação em ambos os sentidos. Inclui verificação do COS desktop.
- TypeScript sem erros; lint dos arquivos alterados e das suítes sem erros; `git diff --check`.

```powershell
npx playwright test tests/e2e/mobile-portal-regressions.spec.ts --workers=1
npx playwright test tests/e2e/landing-mobile-zones.spec.ts --workers=1
npx tsc --noEmit --incremental false --allowImportingTsExtensions
```

Os testes de proposta usam autenticação e documentos simulados, sem gravar propostas reais. Screenshots e diagnósticos locais estão em `.qa-audit-tmp/`, ignorado pelo Git. A validação mobile foi feita por emulação de navegador, não em aparelho iOS/PWA instalado. Alterações anteriores do workspace, incluindo a arte do Studio e ajustes de autenticação, ficam fora deste commit.
