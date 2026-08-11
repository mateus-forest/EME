import { z } from "zod"

export const studioVideoFormats = [
  "Reel vertical 9:16",
  "Story vertical 9:16",
  "Paisagem 16:9",
  "Quadrado 1:1",
] as const

export const studioVideoLegacyDurations = ["15 segundos", "30 segundos", "45 segundos", "60 segundos"] as const

export const studioVideoSelectableDurationOptions = [
  {
    value: "9s",
    label: "9 segundos",
    baseCredits: 22,
  },
] as const

export const studioVideoSelectableDurations = studioVideoSelectableDurationOptions.map((item) => item.value) as ["9s"]
export const studioVideoDefaultDuration = "9s" as const
export const studioVideoDurationAdjustedMessage =
  "A duracao foi ajustada para 9 segundos, compativel com o modelo atual."
export const studioVideoInvalidDurationMessage =
  "A duracao escolhida nao e compativel com o gerador atual. Selecione uma opcao disponivel."

const studioVideoProviderAcceptedDurationsByModel = {
  "ray-2": ["5s", "9s"],
  "ray-flash-2": ["9s"],
} as const

export const studioVideoObjectiveGroups = ["Comercial", "Transformacao", "Institucional"] as const
export const studioVideoTransformationOptions = [
  "Nenhuma",
  "Mobiliar ambiente",
  "Transformar obra em imovel pronto",
  "Home staging",
  "Decorar ambiente",
  "Melhorar iluminacao",
  "Paisagismo",
  "Modernizar acabamentos",
] as const
export const studioVideoRhythmOptions = ["Suave", "Equilibrado", "Dinamico"] as const
export const studioVideoCameraMovementOptions = [
  "Travelling",
  "Dolly",
  "Orbit",
  "Gimbal",
  "Slow Motion",
  "Estatico elegante",
] as const

export const studioVideoObjectives = [
  "Atrair interessados",
  "Gerar visitas",
  "Apresentar o imovel",
  "Destacar diferenciais",
  "Criar anuncio para portais",
  "Criar Reel para Instagram",
  "Criar video para Stories",
  "Fortalecer a marca do corretor",
  "Mobiliar ambiente",
  "Transformar obra em imovel pronto",
  "Melhorar iluminacao",
  "Decorar ambiente",
  "Home staging",
  "Modernizar decoracao",
  "Valorizar area externa",
  "Simular reforma",
  "Video institucional",
  "Apresentacao para investidores",
  "Lancamento imobiliario",
] as const

export const studioVideoStyles = [
  "Cinematografico",
  "Comercial Premium",
  "Arquitetonico",
  "Luxo",
  "Moderno",
  "Minimalista",
  "Instagram/Reels",
  "Dinamico",
  "Lifestyle",
  "Tour guiado",
  "Drone virtual",
  "Alto padrao",
] as const

export const studioVideoPipelineTransformations = [
  "Mobiliar ambiente",
  "Transformar obra em imovel pronto",
  "Home staging",
  "Decorar ambiente",
  "Melhorar iluminacao",
  "Paisagismo",
  "Modernizar acabamentos",
] as const

export const studioVideoRequestKinds = ["direct_video", "transformation_pipeline"] as const
export const studioVideoActiveStages = ["preview", "video"] as const
export const studioVideoJobStages = [
  "queued",
  "preview_processing",
  "preview_ready",
  "preview_approved",
  "video_processing",
  "completed",
  "failed",
] as const

export const studioVideoPreviewImageModel = "photon-flash-1" as const
export const studioVideoFallbackPreviewImageModel = "photon-1" as const
export const studioVideoPreviewVideoModel = "ray-flash-2" as const

export const studioVideoTechnicalSpendLimits = {
  dailyCredits: 180,
  monthlyCredits: 720,
} as const

export const studioVideoCreditPolicy = {
  transformationPreview: 12,
  transformationPreviewRegeneration: 12,
  transformationVideoEconomic: 38,
  transformationVideoFinal: 38,
} as const

export type StudioVideoDuration = (typeof studioVideoSelectableDurations)[number]
export type StudioVideoObjective = (typeof studioVideoObjectives)[number]
export type StudioVideoStyle = (typeof studioVideoStyles)[number]
export type StudioVideoTransformation = (typeof studioVideoTransformationOptions)[number]
export type StudioVideoRhythm = (typeof studioVideoRhythmOptions)[number]
export type StudioVideoCameraMovement = (typeof studioVideoCameraMovementOptions)[number]
export type StudioVideoObjectiveGroup = (typeof studioVideoObjectiveGroups)[number]
export type StudioVideoRequestKind = (typeof studioVideoRequestKinds)[number]
export type StudioVideoActiveStage = (typeof studioVideoActiveStages)[number]
export type StudioVideoJobStage = (typeof studioVideoJobStages)[number]

type ObjectiveConfig = {
  group: StudioVideoObjectiveGroup
  summary: string
  promptBase: string
  storyline: string
  ctaDirection: string
  commercialFocus: string
  complexityCredits: number
}

type StyleConfig = {
  summary: string
  visualDirection: string
  narrativeDirection: string
  cameraDirection: string
  rhythmDirection: string
}

type TransformationConfig = {
  summary: string
  promptDirection: string
  sceneDirection: string
  complexityCredits: number
}

type RhythmConfig = {
  summary: string
  promptDirection: string
  pacing: string
}

type CameraMovementConfig = {
  summary: string
  promptDirection: string
  shotDirection: string
}

export const studioVideoActionType = "studio_ia_video_generation"
export const studioVideoPreviewActionType = "studio_ia_video_preview_generation"
export const studioVideoPreviewRegenerationActionType = "studio_ia_video_preview_regeneration"
export const studioVideoFinalActionType = "studio_ia_video_final_generation"

export const studioVideoObjectiveConfig: Record<StudioVideoObjective, ObjectiveConfig> = {
  "Atrair interessados": {
    group: "Comercial",
    summary: "Impacto inicial para gerar curiosidade e contato.",
    promptBase: "Abra com impacto visual e leitura imediata de valor para chamar novos interessados.",
    storyline: "Construa uma narrativa curta que desperte desejo logo nos primeiros segundos.",
    ctaDirection: "Finalize com sensacao de oportunidade e convite para contato rapido.",
    commercialFocus: "desejo, impacto e geracao de novos leads",
    complexityCredits: 2,
  },
  "Gerar visitas": {
    group: "Comercial",
    summary: "Mostrar fluxo e conforto para estimular agendamento.",
    promptBase: "Priorize circulacao, amplitude e bem-estar para incentivar visitas presenciais.",
    storyline: "Mostre a experiencia de caminhar pelo imovel com naturalidade.",
    ctaDirection: "Encerre com percepcao de imovel pronto para visita.",
    commercialFocus: "visitacao, conforto e decisao presencial",
    complexityCredits: 3,
  },
  "Apresentar o imovel": {
    group: "Comercial",
    summary: "Tour claro, objetivo e confiavel.",
    promptBase: "Organize o video como apresentacao objetiva do imovel, cobrindo fachada, entrada e ambientes-chave.",
    storyline: "Estruture a narrativa como um tour comercial enxuto e bem ordenado.",
    ctaDirection: "Feche reforcando clareza e confianca na apresentacao.",
    commercialFocus: "tour do imovel e leitura completa do produto",
    complexityCredits: 1,
  },
  "Destacar diferenciais": {
    group: "Comercial",
    summary: "Dar enfase aos principais pontos de valor.",
    promptBase: "Valorize acabamentos, vista, area gourmet, lazer e qualquer diferencial competitivo do imovel.",
    storyline: "Construa a narrativa ao redor dos diferenciais que mais valorizam o anuncio.",
    ctaDirection: "Encerre reforcando exclusividade e percepcao de oportunidade.",
    commercialFocus: "diferenciais e percepcao de valor",
    complexityCredits: 2,
  },
  "Criar anuncio para portais": {
    group: "Comercial",
    summary: "Video objetivo, claro e compativel com anuncio.",
    promptBase: "Crie um video direto, altamente legivel e orientado a conversao para portais imobiliarios.",
    storyline: "Mantenha ritmo objetivo com leitura rapida de fachada, ambientes e diferenciais.",
    ctaDirection: "Finalize com sensacao de anuncio pronto para gerar clique e lead.",
    commercialFocus: "performance em anuncio e geracao de lead",
    complexityCredits: 1,
  },
  "Criar Reel para Instagram": {
    group: "Comercial",
    summary: "Conteudo com gancho visual e ritmo social.",
    promptBase: "Crie um video vertical pensado para Instagram Reels, com abertura forte e alto potencial de retencao.",
    storyline: "Mantenha transicoes visuais envolventes e energia comercial contemporanea.",
    ctaDirection: "Feche com atmosfera aspiracional e vontade de compartilhar ou chamar no direct.",
    commercialFocus: "retencao, engajamento e trafego social",
    complexityCredits: 3,
  },
  "Criar video para Stories": {
    group: "Comercial",
    summary: "Mensagem curta e vertical para consumo rapido.",
    promptBase: "Crie um video vertical enxuto para Stories, com leitura imediata e atmosfera comercial leve.",
    storyline: "Concentre-se em poucos momentos de alto impacto visual.",
    ctaDirection: "Finalize com impulso para resposta rapida ou clique.",
    commercialFocus: "agilidade, consumo rapido e resposta imediata",
    complexityCredits: 2,
  },
  "Fortalecer a marca do corretor": {
    group: "Comercial",
    summary: "Transmitir atendimento premium e autoridade.",
    promptBase: "Combine apresentacao do imovel com percepcao de atendimento profissional e curadoria do corretor.",
    storyline: "Use uma narrativa mais institucional-comercial, com elegancia e confianca.",
    ctaDirection: "Encerre reforcando credibilidade, sofisticacao e seguranca na intermediacao.",
    commercialFocus: "marca pessoal, confianca e posicionamento",
    complexityCredits: 2,
  },
  "Mobiliar ambiente": {
    group: "Transformacao",
    summary: "Preencher o espaco com mobiliario coerente e natural.",
    promptBase: "Mostre o ambiente vazio sendo mobiliado de forma elegante, funcional e coerente com o padrao do imovel.",
    storyline: "Transforme a percepcao do espaco por meio da entrada natural de moveis e composicao decorativa.",
    ctaDirection: "Finalize com o espaco completo, acolhedor e pronto para uso.",
    commercialFocus: "visualizacao do potencial do imovel",
    complexityCredits: 8,
  },
  "Transformar obra em imovel pronto": {
    group: "Transformacao",
    summary: "Evoluir de obra para acabamento final premium.",
    promptBase: "Transforme uma obra ou ambiente cru em imovel pronto, finalizado, decorado e comercialmente desejavel.",
    storyline: "Construa uma narrativa de evolucao clara, do bruto ao acabamento premium.",
    ctaDirection: "Encerre com a sensacao de entrega concluida e alto valor percebido.",
    commercialFocus: "antes e depois de alto impacto",
    complexityCredits: 14,
  },
  "Melhorar iluminacao": {
    group: "Transformacao",
    summary: "Elevar a atmosfera luminosa do espaco.",
    promptBase: "Melhore a iluminacao do ambiente para um resultado mais acolhedor, premium e fotogenico.",
    storyline: "Faca a luz valorizar materiais, amplitude e conforto do espaco.",
    ctaDirection: "Finalize com atmosfera luminosa sofisticada e convidativa.",
    commercialFocus: "ambiencia premium e valorizacao visual",
    complexityCredits: 5,
  },
  "Decorar ambiente": {
    group: "Transformacao",
    summary: "Inserir decoracao e styling com naturalidade.",
    promptBase: "Insira decoracao refinada, objetos de apoio, arte e composicao visual que valorizem o ambiente.",
    storyline: "Mostre a decoracao surgindo de forma organica e realista ao longo da cena.",
    ctaDirection: "Encerre com sensacao de ambiente completo e bem curado.",
    commercialFocus: "composicao visual e sofisticacao",
    complexityCredits: 7,
  },
  "Home staging": {
    group: "Transformacao",
    summary: "Preparar o imovel para venda com alto apelo comercial.",
    promptBase: "Aplique home staging para tornar o espaco mais desejavel, leve, organizado e pronto para venda.",
    storyline: "Use staging para aumentar conforto visual, fluidez e intencao de compra.",
    ctaDirection: "Finalize com o espaco visualmente pronto para anuncio premium.",
    commercialFocus: "venda mais rapida e maior apelo comercial",
    complexityCredits: 10,
  },
  "Modernizar decoracao": {
    group: "Transformacao",
    summary: "Atualizar linguagem estetica do ambiente.",
    promptBase: "Modernize a decoracao com escolhas contemporaneas, paleta elegante e composicao atual.",
    storyline: "Evolua o espaco para uma estetica mais atual e valorizada pelo mercado.",
    ctaDirection: "Finalize com identidade moderna e acabamento visual atual.",
    commercialFocus: "atualizacao visual e reposicionamento estetico",
    complexityCredits: 8,
  },
  "Valorizar area externa": {
    group: "Transformacao",
    summary: "Dar vida a varanda, jardim ou area de lazer.",
    promptBase: "Valorize a area externa com mobiliario, vegetacao, iluminacao e atmosfera convidativa.",
    storyline: "Transforme a area externa em protagonista aspiracional do video.",
    ctaDirection: "Encerre com sensacao de bem-estar e uso real da area externa.",
    commercialFocus: "lazer, estilo de vida e permanencia",
    complexityCredits: 9,
  },
  "Simular reforma": {
    group: "Transformacao",
    summary: "Apresentar potencial de renovacao do espaco.",
    promptBase: "Simule uma reforma elegante e crivel, mostrando como o ambiente pode ganhar novo valor.",
    storyline: "Construa a narrativa como atualizacao arquitetonica e valorizacao de mercado.",
    ctaDirection: "Finalize com sensacao de imovel renovado e mais competitivo.",
    commercialFocus: "potencial de valorizacao e visao de futuro",
    complexityCredits: 12,
  },
  "Video institucional": {
    group: "Institucional",
    summary: "Representar marca, posicionamento e qualidade.",
    promptBase: "Crie um video institucional elegante, transmitindo solidez, curadoria e padrao de atendimento.",
    storyline: "Use narrativa mais ampla e posicionada, com foco em percepcao de marca.",
    ctaDirection: "Finalize com autoridade, confianca e presenca de mercado.",
    commercialFocus: "marca, autoridade e reputacao",
    complexityCredits: 3,
  },
  "Apresentacao para investidores": {
    group: "Institucional",
    summary: "Valorizar produto e visao de oportunidade.",
    promptBase: "Crie uma apresentacao visual refinada, voltada a investidores, com percepcao de potencial, contexto e valor.",
    storyline: "Organize a narrativa com clareza, sofisticacao e leitura de oportunidade.",
    ctaDirection: "Encerre com seguranca, escala e perspectiva de retorno.",
    commercialFocus: "oportunidade, seguranca e valor percebido",
    complexityCredits: 4,
  },
  "Lancamento imobiliario": {
    group: "Institucional",
    summary: "Gerar sensacao de novidade e desejo.",
    promptBase: "Crie um video de lancamento com atmosfera aspiracional, impacto e senso de novidade.",
    storyline: "Construa tensao positiva e percepcao de algo novo chegando ao mercado.",
    ctaDirection: "Finalize com energia de lancamento e expectativa alta.",
    commercialFocus: "novidade, desejo e posicionamento",
    complexityCredits: 4,
  },
}

export const studioVideoStyleConfig: Record<StudioVideoStyle, StyleConfig> = {
  Cinematografico: {
    summary: "Narrativa elegante, luz valorizada e sensacao de filme.",
    visualDirection: "Use fotografia rica, contraste controlado, profundidade e acabamento cinematografico.",
    narrativeDirection: "Conte a historia do imovel com suavidade e sofisticacao visual.",
    cameraDirection: "Prefira movimentos fluidos, composicoes amplas e enquadramentos com profundidade.",
    rhythmDirection: "Ritmo refinado, emocional e aspiracional.",
  },
  "Comercial Premium": {
    summary: "Video comercial sofisticado e direto.",
    visualDirection: "Priorize apresentacao premium, imagem limpa e percepcao clara de valor.",
    narrativeDirection: "Mostre o imovel como produto de alta qualidade, pronto para vender.",
    cameraDirection: "Movimentos controlados, elegantes e comerciais.",
    rhythmDirection: "Ritmo objetivo, nobre e convincente.",
  },
  Arquitetonico: {
    summary: "Foco em materiais, volumes e solucoes do espaco.",
    visualDirection: "Destaque linhas, texturas, iluminacao natural e leitura arquitetonica.",
    narrativeDirection: "Conduza o olhar para projeto, amplitude e integracao de ambientes.",
    cameraDirection: "Movimentos tecnicos e estaveis, valorizando eixos e geometrias.",
    rhythmDirection: "Ritmo contemplativo e preciso.",
  },
  Luxo: {
    summary: "Atmosfera aspiracional e acabamento de alto valor.",
    visualDirection: "Valorize materiais nobres, brilho controlado, imponencia e exclusividade.",
    narrativeDirection: "Conduza a narrativa para desejo, status e experiencia premium.",
    cameraDirection: "Movimentos amplos e seguros, com sensacao de grandiosidade.",
    rhythmDirection: "Ritmo confiante, sofisticado e sedutor.",
  },
  Moderno: {
    summary: "Leitura contemporanea e limpa.",
    visualDirection: "Use composicao atual, tons equilibrados e estetica contemporanea.",
    narrativeDirection: "Apresente o imovel como atual, funcional e alinhado ao mercado.",
    cameraDirection: "Movimentos leves e continuos com enquadramentos claros.",
    rhythmDirection: "Ritmo atual e agradavel.",
  },
  Minimalista: {
    summary: "Poucos elementos e maxima elegancia.",
    visualDirection: "Mantenha o visual limpo, arejado e sem excesso de informacao.",
    narrativeDirection: "Deixe espaco, luz e composicao guiarem a experiencia.",
    cameraDirection: "Movimentos discretos e precisos, com longas leituras do ambiente.",
    rhythmDirection: "Ritmo calmo, organizado e respirado.",
  },
  "Instagram/Reels": {
    summary: "Energia visual pronta para retencao social.",
    visualDirection: "Construa cenas com forca visual, clareza imediata e dinamismo vertical.",
    narrativeDirection: "Pense em retencao rapida e impacto nos primeiros segundos.",
    cameraDirection: "Movimentos envolventes e social-first, sem perder elegancia.",
    rhythmDirection: "Ritmo vivo, direto e compartilhavel.",
  },
  Dinamico: {
    summary: "Mais energia e sensacao de movimento.",
    visualDirection: "Use cortes imaginarios fortes e composicao com mais intensidade visual.",
    narrativeDirection: "Conduza a narrativa com senso de urgencia e energia comercial.",
    cameraDirection: "Movimentos mais ativos e progressivos.",
    rhythmDirection: "Ritmo rapido e marcante.",
  },
  Lifestyle: {
    summary: "Mostrar o imovel como experiencia de vida.",
    visualDirection: "Valorize aconchego, rotina aspiracional e uso real do ambiente.",
    narrativeDirection: "Apresente o imovel como cenario de uma vida desejavel.",
    cameraDirection: "Movimentos naturais e convidativos.",
    rhythmDirection: "Ritmo humano, acolhedor e elegante.",
  },
  "Tour guiado": {
    summary: "Sequencia clara e orientada de visita.",
    visualDirection: "Construa leitura linear dos ambientes, sem ruido visual.",
    narrativeDirection: "Guie o espectador por uma ordem clara de descoberta do imovel.",
    cameraDirection: "Movimentos que simulem uma visita profissional e bem conduzida.",
    rhythmDirection: "Ritmo regular, claro e explicativo.",
  },
  "Drone virtual": {
    summary: "Sensacao aerea e de grande escala.",
    visualDirection: "Crie leitura mais ampla, com espacialidade e destaque para contexto.",
    narrativeDirection: "Mostre o imovel como protagonista dentro do entorno e da implantacao.",
    cameraDirection: "Movimentos de ascensao, aproximacao e voo virtual elegante.",
    rhythmDirection: "Ritmo amplo, cinematografico e envolvente.",
  },
  "Alto padrao": {
    summary: "Acabamento sofisticado com foco em valor percebido.",
    visualDirection: "Use atmosfera de alto padrao, refinamento e detalhes de curadoria.",
    narrativeDirection: "Transmita exclusividade, conforto e padrao superior de produto.",
    cameraDirection: "Movimentos seguros, nobres e suaves.",
    rhythmDirection: "Ritmo polido e aspiracional.",
  },
}

export const studioVideoTransformationConfig: Record<StudioVideoTransformation, TransformationConfig> = {
  Nenhuma: {
    summary: "Sem transformacao estrutural, foco em apresentacao.",
    promptDirection: "Nao introduza mudancas estruturais, apenas valorize o que ja existe na imagem.",
    sceneDirection: "Trabalhe a cena como apresentacao comercial fiel ao imovel atual.",
    complexityCredits: 0,
  },
  "Mobiliar ambiente": {
    summary: "Inserir mobiliario elegante e coerente.",
    promptDirection: "Faca moveis, tapetes, luminarias e objetos surgirem com naturalidade e escala correta.",
    sceneDirection: "Mostre o ambiente ganhar funcao, conforto e composicao realista.",
    complexityCredits: 10,
  },
  "Transformar obra em imovel pronto": {
    summary: "Evoluir de obra para entrega final premium.",
    promptDirection: "Converta estrutura crua em acabamento final, iluminacao, mobiliario e decoracao de alto padrao.",
    sceneDirection: "Deixe a transformacao visual clara e progressiva ao longo do video.",
    complexityCredits: 14,
  },
  "Home staging": {
    summary: "Preparar o imovel para venda com melhor apelo.",
    promptDirection: "Organize visualmente o espaco com staging leve, acolhedor e comercialmente atrativo.",
    sceneDirection: "Mostre o ambiente mais leve, desejavel e pronto para anuncio.",
    complexityCredits: 11,
  },
  "Decorar ambiente": {
    summary: "Adicionar decoracao e styling.",
    promptDirection: "Insira plantas, quadros, objetos, tecidos e iluminacao decorativa com naturalidade.",
    sceneDirection: "Faca a decoracao surgir como refinamento do espaco.",
    complexityCredits: 8,
  },
  "Melhorar iluminacao": {
    summary: "Elevar a atmosfera com luz premium.",
    promptDirection: "Melhore a iluminacao natural e artificial para um resultado mais premium e acolhedor.",
    sceneDirection: "Use a luz como elemento de transformacao e valorizacao visual.",
    complexityCredits: 6,
  },
  Paisagismo: {
    summary: "Valorizar areas externas com vegetacao e ambientacao.",
    promptDirection: "Adicione vegetacao, composicao externa e sensacao de espaco vivo e bem cuidado.",
    sceneDirection: "Mostre a area externa ganhar vida, permanencia e sofisticacao.",
    complexityCredits: 9,
  },
  "Modernizar acabamentos": {
    summary: "Atualizar materiais, metais e superficies.",
    promptDirection: "Modernize materiais, cores, metais e acabamentos para uma leitura mais atual e valorizada.",
    sceneDirection: "Faca o espaco parecer renovado, atualizado e mais competitivo.",
    complexityCredits: 12,
  },
}

export const studioVideoRhythmConfig: Record<StudioVideoRhythm, RhythmConfig> = {
  Suave: {
    summary: "Mais contemplativo e elegante.",
    promptDirection: "Mantenha transicoes suaves, leitura respirada e atmosfera serena.",
    pacing: "Ritmo calmo e sofisticado.",
  },
  Equilibrado: {
    summary: "Equilibrio entre emocao e objetividade.",
    promptDirection: "Combine fluidez visual com ritmo comercial equilibrado.",
    pacing: "Ritmo estavel, agradavel e comercial.",
  },
  Dinamico: {
    summary: "Mais energia e progressao visual.",
    promptDirection: "Imprima sensacao de energia, progressao e retencao mais alta.",
    pacing: "Ritmo rapido, ativo e com mais intensidade.",
  },
}

export const studioVideoCameraMovementConfig: Record<StudioVideoCameraMovement, CameraMovementConfig> = {
  Travelling: {
    summary: "Deslocamento suave pelo espaco.",
    promptDirection: "Use travelling elegante para percorrer o ambiente com continuidade.",
    shotDirection: "A camera deve avancar ou atravessar o espaco com fluidez.",
  },
  Dolly: {
    summary: "Aproximacoes e afastamentos controlados.",
    promptDirection: "Use dolly in e dolly out de forma refinada para valorizar profundidade e foco.",
    shotDirection: "A camera deve aproximar e recuar com precisao cinematografica.",
  },
  Orbit: {
    summary: "Movimento circular refinado.",
    promptDirection: "Use orbit ao redor dos pontos de interesse para dar vida e tridimensionalidade.",
    shotDirection: "A camera deve contornar os elementos principais com movimento envolvente.",
  },
  Gimbal: {
    summary: "Estabilidade premium de visita guiada.",
    promptDirection: "Simule camera estabilizada, com leitura fluida e profissional do espaco.",
    shotDirection: "A camera deve percorrer ambientes com suavidade e precisao.",
  },
  "Slow Motion": {
    summary: "Mais contemplacao e dramaticidade.",
    promptDirection: "Acentue uma sensacao de slow motion elegante em momentos-chave.",
    shotDirection: "A camera deve priorizar movimentos lentos, nobres e contemplativos.",
  },
  "Estatico elegante": {
    summary: "Pouco deslocamento, foco em composicao.",
    promptDirection: "Prefira enquadramentos estaveis e sofisticados, com microvariacoes discretas.",
    shotDirection: "A camera deve preservar composicoes fortes e estabilidade visual.",
  },
}

const studioVideoRequestDurationSchema = z.enum(studioVideoSelectableDurations)
const studioVideoJobDurationSchema = z.enum(studioVideoSelectableDurations)
const studioVideoRequestKindSchema = z.enum(studioVideoRequestKinds)
const studioVideoActiveStageSchema = z.enum(studioVideoActiveStages)
const studioVideoJobStageSchema = z.enum(studioVideoJobStages)

export const studioVideoUploadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
})

const studioVideoMetricsSchema = z.object({
  previewEstimatedCredits: z.number().int().min(0).default(0),
  previewRegenerationCredits: z.number().int().min(0).default(0),
  videoEstimatedCredits: z.number().int().min(0).default(0),
  totalCreditsConsumed: z.number().int().min(0).default(0),
  totalCreditsRefunded: z.number().int().min(0).default(0),
  previewAttempts: z.number().int().min(0).default(0),
  videoAttempts: z.number().int().min(0).default(0),
  retryCount: z.number().int().min(0).default(0),
  qualityDifferenceScore: z.number().min(0).max(1).optional(),
  qualityDifferenceThreshold: z.number().min(0).max(1).optional(),
  estimatedProviderCostUsd: z.number().min(0).optional(),
  actualProviderCostUsd: z.number().min(0).optional(),
  stageStartedAt: z.string().trim().min(1).optional(),
  stageCompletedAt: z.string().trim().min(1).optional(),
}).default({
  previewEstimatedCredits: 0,
  previewRegenerationCredits: 0,
  videoEstimatedCredits: 0,
  totalCreditsConsumed: 0,
  totalCreditsRefunded: 0,
  previewAttempts: 0,
  videoAttempts: 0,
  retryCount: 0,
})

export const studioVideoRequestSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(191).optional(),
    sourceAssetId: z.string().trim().min(1).max(191).optional(),
    referenceImageUrls: z.array(z.string().trim().url()).max(1).default([]),
    uploadedImages: z.array(studioVideoUploadSchema).max(1).default([]),
    format: z.enum(studioVideoFormats),
    duration: studioVideoRequestDurationSchema,
    objective: z.enum(studioVideoObjectives),
    style: z.enum(studioVideoStyles),
    transformation: z.enum(studioVideoTransformationOptions).default("Nenhuma"),
    rhythm: z.enum(studioVideoRhythmOptions).default("Equilibrado"),
    cameraMovement: z.enum(studioVideoCameraMovementOptions).default("Gimbal"),
    additionalInstructions: z.string().trim().max(600).default(""),
    version: z.number().int().min(1).max(20).default(1),
  })
  .superRefine((payload, ctx) => {
    const hasReferenceSelection = payload.referenceImageUrls.length === 1
    const hasPropertyOrigin = Boolean(payload.propertyId)
    const hasPreparedAssetOrigin = Boolean(payload.sourceAssetId)
    const hasUploadSelection = payload.uploadedImages.length > 0
    const sourceCount = Number(hasPropertyOrigin) + Number(hasPreparedAssetOrigin) + Number(hasUploadSelection)

    if (sourceCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione uma fotografia do imovel ou envie uma imagem.",
        path: ["referenceImageUrls"],
      })
    }

    if (sourceCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha somente uma imagem principal para o video.",
        path: ["referenceImageUrls"],
      })
    }

    if ((hasPropertyOrigin || hasPreparedAssetOrigin) && !hasReferenceSelection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione a imagem principal desta origem.",
        path: ["referenceImageUrls"],
      })
    }

    if (hasReferenceSelection && !payload.propertyId && !payload.sourceAssetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A origem da imagem principal nao foi informada.",
        path: ["referenceImageUrls"],
      })
    }
  })

export const studioVideoResultSchema = z.object({
  requestId: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  estimatedCredits: z.number().int().min(0),
  stageEstimatedCredits: z.number().int().min(0).default(0),
  totalCreditsConsumed: z.number().int().min(0).default(0),
  generationStatus: z.enum(["queued", "processing", "completed", "failed"]),
  requestKind: studioVideoRequestKindSchema.default("direct_video"),
  jobStage: studioVideoJobStageSchema.default("queued"),
  activeStage: studioVideoActiveStageSchema.default("video"),
  requiresPreviewApproval: z.boolean().default(false),
  previewApproved: z.boolean().default(false),
  previewImageUrl: z.string().trim().url().optional(),
  previewPrompt: z.string().trim().min(1).max(4000).optional(),
  previewErrorMessage: z.string().trim().max(400).optional(),
  previewQualityScore: z.number().min(0).max(1).optional(),
  canCreateVideo: z.boolean().default(false),
  canRegeneratePreview: z.boolean().default(false),
  storyboard: z.array(z.string().trim().min(1).max(220)).min(3).max(6),
  script: z.string().trim().min(1).max(2200),
  shotPlan: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  duration: studioVideoRequestDurationSchema,
  promptPreview: z.string().trim().min(1).max(4000),
  videoUrl: z.string().trim().url().optional(),
  fileSaved: z.boolean().default(false),
  progress: z.number().min(0).max(100).default(0),
  providerModel: z.string().trim().min(1).optional(),
  previewModel: z.string().trim().min(1).optional(),
  errorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
  technicalLimitReached: z.boolean().default(false),
})

export const studioVideoJobContentSchema = z.object({
  provider: z.string().trim().min(1),
  providerVideoId: z.string().trim().min(1).optional(),
  providerImageId: z.string().trim().min(1).optional(),
  campaignId: z.string().trim().min(1).optional(),
  generationLockId: z.string().trim().min(1).optional(),
  estimatedCredits: z.number().int().min(0),
  stageEstimatedCredits: z.number().int().min(0).default(0),
  propertyId: z.string().trim().min(1).optional(),
  propertyTitle: z.string().trim().min(1).optional(),
  propertyLocation: z.string().trim().min(1).optional(),
  referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
  uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
  sourceReferenceUrl: z.string().trim().url().optional(),
  previewImageUrl: z.string().trim().url().optional(),
  previewPrompt: z.string().trim().min(1).max(4000).optional(),
  previewApprovedAt: z.string().trim().min(1).optional(),
  previewApproved: z.boolean().default(false),
  requestKind: studioVideoRequestKindSchema.default("direct_video"),
  jobStage: studioVideoJobStageSchema.default("queued"),
  activeStage: studioVideoActiveStageSchema.default("video"),
  requiresPreviewApproval: z.boolean().default(false),
  format: z.enum(studioVideoFormats),
  duration: studioVideoJobDurationSchema,
  objective: z.enum(studioVideoObjectives),
  style: z.enum(studioVideoStyles),
  transformation: z.enum(studioVideoTransformationOptions),
  rhythm: z.enum(studioVideoRhythmOptions),
  cameraMovement: z.enum(studioVideoCameraMovementOptions),
  additionalInstructions: z.string().trim().max(600).default(""),
  prompt: z.string().trim().min(1),
  storyboard: z.array(z.string().trim().min(1).max(220)).min(3).max(6),
  script: z.string().trim().min(1).max(2200),
  shotPlan: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  generationStatus: z.enum(["queued", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100).default(0),
  videoUrl: z.string().trim().url().optional(),
  savedDocumentId: z.string().trim().min(1).optional(),
  creditsCharged: z.boolean().default(false),
  creditsRefunded: z.boolean().default(false),
  stageCreditsCharged: z.number().int().min(0).default(0),
  stageCreditsRefunded: z.number().int().min(0).default(0),
  providerModel: z.string().trim().min(1).optional(),
  previewModel: z.string().trim().min(1).optional(),
  requestSignature: z.string().trim().min(1).optional(),
  technicalLimitReached: z.boolean().default(false),
  errorMessage: z.string().trim().max(400).optional(),
  previewErrorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
  metrics: studioVideoMetricsSchema,
})

export type StudioVideoRequest = z.infer<typeof studioVideoRequestSchema>
export type StudioVideoResult = z.infer<typeof studioVideoResultSchema>
export type StudioVideoJobContent = z.infer<typeof studioVideoJobContentSchema>

export function getStudioVideoDurationLabel(duration: StudioVideoDuration) {
  return studioVideoSelectableDurationOptions.find((item) => item.value === duration)?.label ?? "9 segundos"
}

export function requiresTransformationPreview(transformation: StudioVideoTransformation) {
  return studioVideoPipelineTransformations.includes(
    transformation as (typeof studioVideoPipelineTransformations)[number],
  )
}

export function getStudioVideoRequestKind(transformation: StudioVideoTransformation): StudioVideoRequestKind {
  return requiresTransformationPreview(transformation) ? "transformation_pipeline" : "direct_video"
}

export function getStudioVideoPreviewCredits(options?: { regeneration?: boolean }) {
  return options?.regeneration
    ? studioVideoCreditPolicy.transformationPreviewRegeneration
    : studioVideoCreditPolicy.transformationPreview
}

export function getStudioVideoVideoStageCredits(model: string) {
  return model === studioVideoPreviewVideoModel
    ? studioVideoCreditPolicy.transformationVideoEconomic
    : studioVideoCreditPolicy.transformationVideoFinal
}

export function getStudioVideoEstimatedCredits(input: {
  duration: StudioVideoDuration
  objective: StudioVideoObjective
  transformation: StudioVideoTransformation
  stage?: "preview" | "preview_regeneration" | "video" | "direct"
  model?: string
}) {
  const requestKind = getStudioVideoRequestKind(input.transformation)
  const stage = input.stage ?? (requestKind === "transformation_pipeline" ? "preview" : "direct")

  if (stage === "preview") return getStudioVideoPreviewCredits()
  if (stage === "preview_regeneration") return getStudioVideoPreviewCredits({ regeneration: true })
  if (stage === "video") return getStudioVideoVideoStageCredits(input.model || studioVideoPreviewVideoModel)

  const baseCredits = studioVideoSelectableDurationOptions.find((item) => item.value === input.duration)?.baseCredits ?? 22
  const objectiveCredits = studioVideoObjectiveConfig[input.objective].complexityCredits
  const transformationCredits = studioVideoTransformationConfig[input.transformation].complexityCredits

  return baseCredits + Math.max(objectiveCredits, transformationCredits)
}

export function getStudioVideoProviderAcceptedDurations(model: string) {
  if (model in studioVideoProviderAcceptedDurationsByModel) {
    return studioVideoProviderAcceptedDurationsByModel[model as keyof typeof studioVideoProviderAcceptedDurationsByModel]
  }

  return studioVideoSelectableDurations
}

export function isStudioVideoSelectableDuration(value: string): value is StudioVideoDuration {
  return studioVideoSelectableDurations.includes(value as StudioVideoDuration)
}

export function normalizeStudioVideoDuration(value: unknown) {
  if (typeof value !== "string") {
    return { duration: studioVideoDefaultDuration, adjusted: false }
  }

  const normalized = value.trim()
  if (isStudioVideoSelectableDuration(normalized)) {
    return { duration: normalized, adjusted: false }
  }

  if (studioVideoLegacyDurations.includes(normalized as (typeof studioVideoLegacyDurations)[number])) {
    return { duration: studioVideoDefaultDuration, adjusted: true }
  }

  return { duration: studioVideoDefaultDuration, adjusted: false }
}
