# Marketplace — reprodução de vídeo (2026-09-06)

## Correções

- Reprodução inline/muted compartilhada entre hero e transição, com tentativas limitadas após metadata/canplay, rejeição de play, pageshow, foco e retorno de visibilidade. Sem reinicializar o download com load().
- Visibilidade da hero calculada pelo retângulo real e visualViewport; entradas iniciais incorretas do IntersectionObserver não bastam para pausar um vídeo visível.
- Próximo clipe preparado durante a reprodução, e não junto com o primeiro download. O vídeo de saída continua tocando durante o dissolve. A hero pausa enquanto a transição cinematográfica a cobre.
- Cada busca possui uma nova instância de vídeo. Resultados prontos não interrompem a reprodução; ended libera a saída somente quando os resultados também estão prontos. O frame final permanece enquanto necessário.
- Failsafe mantido para erro de mídia ou 15 segundos sem progresso; uma reprodução saudável não é cortada por um prazo fixo contado desde o início.
- Loader com o asset oficial `/images/eme-logo-header-official.png`; removida a marca em texto dos posters.

## Validação

Suíte: `npx playwright test tests/e2e/marketplace-video-playback.spec.ts --reporter=line`.

- Chromium: desktop 1440px e mobile 390/393/430px; autoplay, pageshow, duas buscas reais consecutivas, source correto e evento ended antes da saída.
- Resultados atrasados: frame final visível enquanto aguarda a resposta.
- Erro de mídia: saída recuperável sem loader infinito.
- Falhas transitórias de play e entrada incorreta de IntersectionObserver simuladas; pausa fora da viewport, retorno e refresh.
- Inspeção visual adicional em Chromium e WebKit: desktop 1440×900 e mobile 390×844, sem pageerror observado. Capturas locais em `.qa-audit-tmp/marketplace-*.png` (não versionadas).
- ESLint dos quatro componentes/hook alterados e da suíte; `npm run build`, incluindo TypeScript.

## Assets preservados e limites

Nenhum MP4 foi alterado, recomprimido ou substituído:

| Fonte | Resolução original | Duração aproximada |
| --- | --- | --- |
| hero-1 / hero-2 / hero-5 | 1280×720 | 6,02 s |
| hero-3 | 1280×720 | 4,01 s |
| hero-4 | 1280×720 | 8 s |
| search-loading-desktop | 1280×720 | 8,08 s |
| search-loading-mobile | 2160×3840 | 7,57 s |

A transição seleciona somente desktop ou mobile ao iniciar cada busca. **Não existe versão vertical dos cinco clipes da hero no projeto**; esses originais permanecem no mobile com o enquadramento existente. É necessário fornecer os equivalentes 9:16 para atender integralmente esse requisito sem trocar o conteúdo.

WebKit em Windows e viewport mobile não equivalem a um iPhone físico. Permanecem pendentes Safari/PWA real, bloquear/desbloquear tela, background prolongado, condições de rede/dispositivo e economia de energia. As tentativas de autoplay tratam rejeições, mas não sobrepõem políticas do navegador/SO. Não foi feita medição de FPS em hardware móvel.

Busca, regras de negócio, textos e layout não foram alterados. Mudanças externas em Auth, landing, CSS global e testes anteriores não pertencem a este trabalho.
