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
  "A duração foi ajustada para 9 segundos, compatível com o modelo atual."
export const studioVideoInvalidDurationMessage =
  "A duração escolhida não é compatível com o gerador atual. Selecione uma opção disponível."

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

export type StudioVideoDuration = (typeof studioVideoSelectableDurations)[number]
export type StudioVideoObjective = (typeof studioVideoObjectives)[number]
export type StudioVideoStyle = (typeof studioVideoStyles)[number]
export type StudioVideoTransformation = (typeof studioVideoTransformationOptions)[number]
export type StudioVideoRhythm = (typeof studioVideoRhythmOptions)[number]
export type StudioVideoCameraMovement = (typeof studioVideoCameraMovementOptions)[number]
export type StudioVideoObjectiveGroup = (typeof studioVideoObjectiveGroups)[number]

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

export const studioVideoObjectiveConfig: Record<StudioVideoObjective, ObjectiveConfig> = {
  "Atrair interessados": {
    group: "Comercial",
    summary: "Impacto inicial para gerar curiosidade e contato.",
    promptBase: "Abra com impacto visual e leitura imediata de valor para chamar novos interessados.",
    storyline: "Construa uma narrativa curta que desperte desejo logo nos primeiros segundos.",
    ctaDirection: "Finalize com sensação de oportunidade e convite para contato rápido.",
    commercialFocus: "desejo, impacto e geração de novos leads",
    complexityCredits: 2,
  },
  "Gerar visitas": {
    group: "Comercial",
    summary: "Mostrar fluxo e conforto para estimular agendamento.",
    promptBase: "Priorize circulação, amplitude e bem-estar para incentivar visitas presenciais.",
    storyline: "Mostre a experiência de caminhar pelo imóvel com naturalidade.",
    ctaDirection: "Encerre com percepção de imóvel pronto para visita.",
    commercialFocus: "visitação, conforto e decisão presencial",
    complexityCredits: 3,
  },
  "Apresentar o imovel": {
    group: "Comercial",
    summary: "Tour claro, objetivo e confiável.",
    promptBase: "Organize o vídeo como apresentação objetiva do imóvel, cobrindo fachada, entrada e ambientes-chave.",
    storyline: "Estruture a narrativa como um tour comercial enxuto e bem ordenado.",
    ctaDirection: "Feche reforçando clareza e confiança na apresentação.",
    commercialFocus: "tour do imóvel e leitura completa do produto",
    complexityCredits: 1,
  },
  "Destacar diferenciais": {
    group: "Comercial",
    summary: "Dar ênfase aos principais pontos de valor.",
    promptBase: "Valorize acabamentos, vista, área gourmet, lazer e qualquer diferencial competitivo do imóvel.",
    storyline: "Construa a narrativa ao redor dos diferenciais que mais valorizam o anúncio.",
    ctaDirection: "Encerre reforçando exclusividade e percepção de oportunidade.",
    commercialFocus: "diferenciais e percepção de valor",
    complexityCredits: 2,
  },
  "Criar anuncio para portais": {
    group: "Comercial",
    summary: "Vídeo objetivo, claro e compatível com anúncio.",
    promptBase: "Crie um vídeo direto, altamente legível e orientado a conversão para portais imobiliários.",
    storyline: "Mantenha ritmo objetivo com leitura rápida de fachada, ambientes e diferenciais.",
    ctaDirection: "Finalize com sensação de anúncio pronto para gerar clique e lead.",
    commercialFocus: "performance em anúncio e geração de lead",
    complexityCredits: 1,
  },
  "Criar Reel para Instagram": {
    group: "Comercial",
    summary: "Conteúdo com gancho visual e ritmo social.",
    promptBase: "Crie um vídeo vertical pensado para Instagram Reels, com abertura forte e alto potencial de retenção.",
    storyline: "Mantenha transições visuais envolventes e energia comercial contemporânea.",
    ctaDirection: "Feche com atmosfera aspiracional e vontade de compartilhar ou chamar no direct.",
    commercialFocus: "retenção, engajamento e tráfego social",
    complexityCredits: 3,
  },
  "Criar video para Stories": {
    group: "Comercial",
    summary: "Mensagem curta e vertical para consumo rápido.",
    promptBase: "Crie um vídeo vertical enxuto para Stories, com leitura imediata e atmosfera comercial leve.",
    storyline: "Concentre-se em poucos momentos de alto impacto visual.",
    ctaDirection: "Finalize com impulso para resposta rápida ou clique.",
    commercialFocus: "agilidade, consumo rápido e resposta imediata",
    complexityCredits: 2,
  },
  "Fortalecer a marca do corretor": {
    group: "Comercial",
    summary: "Transmitir atendimento premium e autoridade.",
    promptBase: "Combine apresentação do imóvel com percepção de atendimento profissional e curadoria do corretor.",
    storyline: "Use uma narrativa mais institucional-comercial, com elegância e confiança.",
    ctaDirection: "Encerre reforçando credibilidade, sofisticação e segurança na intermediação.",
    commercialFocus: "marca pessoal, confiança e posicionamento",
    complexityCredits: 2,
  },
  "Mobiliar ambiente": {
    group: "Transformacao",
    summary: "Preencher o espaço com mobiliário coerente e natural.",
    promptBase: "Mostre o ambiente vazio sendo mobiliado de forma elegante, funcional e coerente com o padrão do imóvel.",
    storyline: "Transforme a percepção do espaço por meio da entrada natural de móveis e composição decorativa.",
    ctaDirection: "Finalize com o espaço completo, acolhedor e pronto para uso.",
    commercialFocus: "visualização do potencial do imóvel",
    complexityCredits: 8,
  },
  "Transformar obra em imovel pronto": {
    group: "Transformacao",
    summary: "Evoluir de obra para acabamento final premium.",
    promptBase: "Transforme uma obra ou ambiente cru em imóvel pronto, finalizado, decorado e comercialmente desejável.",
    storyline: "Construa uma narrativa de evolução clara, do bruto ao acabamento premium.",
    ctaDirection: "Encerre com a sensação de entrega concluída e alto valor percebido.",
    commercialFocus: "antes e depois de alto impacto",
    complexityCredits: 14,
  },
  "Melhorar iluminacao": {
    group: "Transformacao",
    summary: "Elevar a atmosfera luminosa do espaço.",
    promptBase: "Melhore a iluminação do ambiente para um resultado mais acolhedor, premium e fotogênico.",
    storyline: "Faça a luz valorizar materiais, amplitude e conforto do espaço.",
    ctaDirection: "Finalize com atmosfera luminosa sofisticada e convidativa.",
    commercialFocus: "ambiência premium e valorização visual",
    complexityCredits: 5,
  },
  "Decorar ambiente": {
    group: "Transformacao",
    summary: "Inserir decoração e styling com naturalidade.",
    promptBase: "Insira decoração refinada, objetos de apoio, arte e composição visual que valorizem o ambiente.",
    storyline: "Mostre a decoração surgindo de forma orgânica e realista ao longo da cena.",
    ctaDirection: "Encerre com sensação de ambiente completo e bem curado.",
    commercialFocus: "composição visual e sofisticação",
    complexityCredits: 7,
  },
  "Home staging": {
    group: "Transformacao",
    summary: "Preparar o imóvel para venda com alto apelo comercial.",
    promptBase: "Aplique home staging para tornar o espaço mais desejável, leve, organizado e pronto para venda.",
    storyline: "Use staging para aumentar conforto visual, fluidez e intenção de compra.",
    ctaDirection: "Finalize com o espaço visualmente pronto para anúncio premium.",
    commercialFocus: "venda mais rápida e maior apelo comercial",
    complexityCredits: 10,
  },
  "Modernizar decoracao": {
    group: "Transformacao",
    summary: "Atualizar linguagem estética do ambiente.",
    promptBase: "Modernize a decoração com escolhas contemporâneas, paleta elegante e composição atual.",
    storyline: "Evolua o espaço para uma estética mais atual e valorizada pelo mercado.",
    ctaDirection: "Finalize com identidade moderna e acabamento visual atual.",
    commercialFocus: "atualização visual e reposicionamento estético",
    complexityCredits: 8,
  },
  "Valorizar area externa": {
    group: "Transformacao",
    summary: "Dar vida a varanda, jardim ou área de lazer.",
    promptBase: "Valorize a área externa com mobiliário, vegetação, iluminação e atmosfera convidativa.",
    storyline: "Transforme a área externa em protagonista aspiracional do vídeo.",
    ctaDirection: "Encerre com sensação de bem-estar e uso real da área externa.",
    commercialFocus: "lazer, estilo de vida e permanência",
    complexityCredits: 9,
  },
  "Simular reforma": {
    group: "Transformacao",
    summary: "Apresentar potencial de renovação do espaço.",
    promptBase: "Simule uma reforma elegante e crível, mostrando como o ambiente pode ganhar novo valor.",
    storyline: "Construa a narrativa como atualização arquitetônica e valorização de mercado.",
    ctaDirection: "Finalize com sensação de imóvel renovado e mais competitivo.",
    commercialFocus: "potencial de valorização e visão de futuro",
    complexityCredits: 12,
  },
  "Video institucional": {
    group: "Institucional",
    summary: "Representar marca, posicionamento e qualidade.",
    promptBase: "Crie um vídeo institucional elegante, transmitindo solidez, curadoria e padrão de atendimento.",
    storyline: "Use narrativa mais ampla e posicionada, com foco em percepção de marca.",
    ctaDirection: "Finalize com autoridade, confiança e presença de mercado.",
    commercialFocus: "marca, autoridade e reputação",
    complexityCredits: 3,
  },
  "Apresentacao para investidores": {
    group: "Institucional",
    summary: "Valorizar produto e visão de oportunidade.",
    promptBase: "Crie uma apresentação visual refinada, voltada a investidores, com percepção de potencial, contexto e valor.",
    storyline: "Organize a narrativa com clareza, sofisticação e leitura de oportunidade.",
    ctaDirection: "Encerre com segurança, escala e perspectiva de retorno.",
    commercialFocus: "oportunidade, segurança e valor percebido",
    complexityCredits: 4,
  },
  "Lancamento imobiliario": {
    group: "Institucional",
    summary: "Gerar sensação de novidade e desejo.",
    promptBase: "Crie um vídeo de lançamento com atmosfera aspiracional, impacto e senso de novidade.",
    storyline: "Construa tensão positiva e percepção de algo novo chegando ao mercado.",
    ctaDirection: "Finalize com energia de lançamento e expectativa alta.",
    commercialFocus: "novidade, desejo e posicionamento",
    complexityCredits: 4,
  },
}

export const studioVideoStyleConfig: Record<StudioVideoStyle, StyleConfig> = {
  Cinematografico: {
    summary: "Narrativa elegante, luz valorizada e sensação de filme.",
    visualDirection: "Use fotografia rica, contraste controlado, profundidade e acabamento cinematográfico.",
    narrativeDirection: "Conte a história do imóvel com suavidade e sofisticação visual.",
    cameraDirection: "Prefira movimentos fluidos, composições amplas e enquadramentos com profundidade.",
    rhythmDirection: "Ritmo refinado, emocional e aspiracional.",
  },
  "Comercial Premium": {
    summary: "Vídeo comercial sofisticado e direto.",
    visualDirection: "Priorize apresentação premium, imagem limpa e percepção clara de valor.",
    narrativeDirection: "Mostre o imóvel como produto de alta qualidade, pronto para vender.",
    cameraDirection: "Movimentos controlados, elegantes e comerciais.",
    rhythmDirection: "Ritmo objetivo, nobre e convincente.",
  },
  Arquitetonico: {
    summary: "Foco em materiais, volumes e soluções do espaço.",
    visualDirection: "Destaque linhas, texturas, iluminação natural e leitura arquitetônica.",
    narrativeDirection: "Conduza o olhar para projeto, amplitude e integração de ambientes.",
    cameraDirection: "Movimentos técnicos e estáveis, valorizando eixos e geometrias.",
    rhythmDirection: "Ritmo contemplativo e preciso.",
  },
  Luxo: {
    summary: "Atmosfera aspiracional e acabamento de alto valor.",
    visualDirection: "Valorize materiais nobres, brilho controlado, imponência e exclusividade.",
    narrativeDirection: "Conduza a narrativa para desejo, status e experiência premium.",
    cameraDirection: "Movimentos amplos e seguros, com sensação de grandiosidade.",
    rhythmDirection: "Ritmo confiante, sofisticado e sedutor.",
  },
  Moderno: {
    summary: "Leitura contemporânea e limpa.",
    visualDirection: "Use composição atual, tons equilibrados e estética contemporânea.",
    narrativeDirection: "Apresente o imóvel como atual, funcional e alinhado ao mercado.",
    cameraDirection: "Movimentos leves e contínuos com enquadramentos claros.",
    rhythmDirection: "Ritmo atual e agradável.",
  },
  Minimalista: {
    summary: "Poucos elementos e máxima elegância.",
    visualDirection: "Mantenha o visual limpo, arejado e sem excesso de informação.",
    narrativeDirection: "Deixe espaço, luz e composição guiarem a experiência.",
    cameraDirection: "Movimentos discretos e precisos, com longas leituras do ambiente.",
    rhythmDirection: "Ritmo calmo, organizado e respirado.",
  },
  "Instagram/Reels": {
    summary: "Energia visual pronta para retenção social.",
    visualDirection: "Construa cenas com força visual, clareza imediata e dinamismo vertical.",
    narrativeDirection: "Pense em retenção rápida e impacto nos primeiros segundos.",
    cameraDirection: "Movimentos envolventes e social-first, sem perder elegância.",
    rhythmDirection: "Ritmo vivo, direto e compartilhável.",
  },
  Dinamico: {
    summary: "Mais energia e sensação de movimento.",
    visualDirection: "Use cortes imaginários fortes e composição com mais intensidade visual.",
    narrativeDirection: "Conduza a narrativa com senso de urgência e energia comercial.",
    cameraDirection: "Movimentos mais ativos e progressivos.",
    rhythmDirection: "Ritmo rápido e marcante.",
  },
  Lifestyle: {
    summary: "Mostrar o imóvel como experiência de vida.",
    visualDirection: "Valorize aconchego, rotina aspiracional e uso real do ambiente.",
    narrativeDirection: "Apresente o imóvel como cenário de uma vida desejável.",
    cameraDirection: "Movimentos naturais e convidativos.",
    rhythmDirection: "Ritmo humano, acolhedor e elegante.",
  },
  "Tour guiado": {
    summary: "Sequência clara e orientada de visita.",
    visualDirection: "Construa leitura linear dos ambientes, sem ruído visual.",
    narrativeDirection: "Guie o espectador por uma ordem clara de descoberta do imóvel.",
    cameraDirection: "Movimentos que simulem uma visita profissional e bem conduzida.",
    rhythmDirection: "Ritmo regular, claro e explicativo.",
  },
  "Drone virtual": {
    summary: "Sensação aérea e de grande escala.",
    visualDirection: "Crie leitura mais ampla, com espacialidade e destaque para contexto.",
    narrativeDirection: "Mostre o imóvel como protagonista dentro do entorno e da implantação.",
    cameraDirection: "Movimentos de ascensão, aproximação e voo virtual elegante.",
    rhythmDirection: "Ritmo amplo, cinematográfico e envolvente.",
  },
  "Alto padrao": {
    summary: "Acabamento sofisticado com foco em valor percebido.",
    visualDirection: "Use atmosfera de alto padrão, refinamento e detalhes de curadoria.",
    narrativeDirection: "Transmita exclusividade, conforto e padrão superior de produto.",
    cameraDirection: "Movimentos seguros, nobres e suaves.",
    rhythmDirection: "Ritmo polido e aspiracional.",
  },
}

export const studioVideoTransformationConfig: Record<StudioVideoTransformation, TransformationConfig> = {
  Nenhuma: {
    summary: "Sem transformação estrutural, foco em apresentação.",
    promptDirection: "Não introduza mudanças estruturais, apenas valorize o que já existe na imagem.",
    sceneDirection: "Trabalhe a cena como apresentação comercial fiel ao imóvel atual.",
    complexityCredits: 0,
  },
  "Mobiliar ambiente": {
    summary: "Inserir mobiliário elegante e coerente.",
    promptDirection: "Faça móveis, tapetes, luminárias e objetos surgirem com naturalidade e escala correta.",
    sceneDirection: "Mostre o ambiente ganhar função, conforto e composição realista.",
    complexityCredits: 10,
  },
  "Transformar obra em imovel pronto": {
    summary: "Evoluir de obra para entrega final premium.",
    promptDirection: "Converta estrutura crua em acabamento final, iluminação, mobiliário e decoração de alto padrão.",
    sceneDirection: "Deixe a transformação visual clara e progressiva ao longo do vídeo.",
    complexityCredits: 14,
  },
  "Home staging": {
    summary: "Preparar o imóvel para venda com melhor apelo.",
    promptDirection: "Organize visualmente o espaço com staging leve, acolhedor e comercialmente atrativo.",
    sceneDirection: "Mostre o ambiente mais leve, desejável e pronto para anúncio.",
    complexityCredits: 11,
  },
  "Decorar ambiente": {
    summary: "Adicionar decoração e styling.",
    promptDirection: "Insira plantas, quadros, objetos, tecidos e iluminação decorativa com naturalidade.",
    sceneDirection: "Faça a decoração surgir como refinamento do espaço.",
    complexityCredits: 8,
  },
  "Melhorar iluminacao": {
    summary: "Elevar a atmosfera com luz premium.",
    promptDirection: "Melhore a iluminação natural e artificial para um resultado mais premium e acolhedor.",
    sceneDirection: "Use a luz como elemento de transformação e valorização visual.",
    complexityCredits: 6,
  },
  Paisagismo: {
    summary: "Valorizar áreas externas com vegetação e ambientação.",
    promptDirection: "Adicione vegetação, composição externa e sensação de espaço vivo e bem cuidado.",
    sceneDirection: "Mostre a área externa ganhar vida, permanência e sofisticação.",
    complexityCredits: 9,
  },
  "Modernizar acabamentos": {
    summary: "Atualizar materiais, metais e superfícies.",
    promptDirection: "Modernize materiais, cores, metais e acabamentos para uma leitura mais atual e valorizada.",
    sceneDirection: "Faça o espaço parecer renovado, atualizado e mais competitivo.",
    complexityCredits: 12,
  },
}

export const studioVideoRhythmConfig: Record<StudioVideoRhythm, RhythmConfig> = {
  Suave: {
    summary: "Mais contemplativo e elegante.",
    promptDirection: "Mantenha transições suaves, leitura respirada e atmosfera serena.",
    pacing: "Ritmo calmo e sofisticado.",
  },
  Equilibrado: {
    summary: "Equilíbrio entre emoção e objetividade.",
    promptDirection: "Combine fluidez visual com ritmo comercial equilibrado.",
    pacing: "Ritmo estável, agradável e comercial.",
  },
  Dinamico: {
    summary: "Mais energia e progressão visual.",
    promptDirection: "Imprima sensação de energia, progressão e retenção mais alta.",
    pacing: "Ritmo rápido, ativo e com mais intensidade.",
  },
}

export const studioVideoCameraMovementConfig: Record<StudioVideoCameraMovement, CameraMovementConfig> = {
  Travelling: {
    summary: "Deslocamento suave pelo espaço.",
    promptDirection: "Use travelling elegante para percorrer o ambiente com continuidade.",
    shotDirection: "A câmera deve avançar ou atravessar o espaço com fluidez.",
  },
  Dolly: {
    summary: "Aproximações e afastamentos controlados.",
    promptDirection: "Use dolly in e dolly out de forma refinada para valorizar profundidade e foco.",
    shotDirection: "A câmera deve aproximar e recuar com precisão cinematográfica.",
  },
  Orbit: {
    summary: "Movimento circular refinado.",
    promptDirection: "Use orbit ao redor dos pontos de interesse para dar vida e tridimensionalidade.",
    shotDirection: "A câmera deve contornar os elementos principais com movimento envolvente.",
  },
  Gimbal: {
    summary: "Estabilidade premium de visita guiada.",
    promptDirection: "Simule câmera estabilizada, com leitura fluida e profissional do espaço.",
    shotDirection: "A câmera deve percorrer ambientes com suavidade e precisão.",
  },
  "Slow Motion": {
    summary: "Mais contemplação e dramaticidade.",
    promptDirection: "Acentue uma sensação de slow motion elegante em momentos-chave.",
    shotDirection: "A câmera deve priorizar movimentos lentos, nobres e contemplativos.",
  },
  "Estatico elegante": {
    summary: "Pouco deslocamento, foco em composição.",
    promptDirection: "Prefira enquadramentos estáveis e sofisticados, com microvariações discretas.",
    shotDirection: "A câmera deve preservar composições fortes e estabilidade visual.",
  },
}

export const studioVideoUploadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(120),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
})

const studioVideoRequestDurationSchema = z.enum(studioVideoSelectableDurations)
const studioVideoJobDurationSchema = z.enum(studioVideoSelectableDurations)

export const studioVideoRequestSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(191).optional(),
    referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
    uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
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
    const hasPropertySelection = Boolean(payload.propertyId && payload.referenceImageUrls.length > 0)
    const hasUploadSelection = payload.uploadedImages.length > 0

    if (!hasPropertySelection && !hasUploadSelection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos uma imagem do imovel ou envie imagens de referencia.",
        path: ["referenceImageUrls"],
      })
    }
  })

export const studioVideoResultSchema = z.object({
  requestId: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  estimatedCredits: z.number().int().min(1),
  generationStatus: z.enum(["queued", "processing", "completed", "failed"]),
  storyboard: z.array(z.string().trim().min(1).max(220)).min(3).max(6),
  script: z.string().trim().min(1).max(2200),
  shotPlan: z.array(z.string().trim().min(1).max(180)).min(3).max(8),
  duration: studioVideoRequestDurationSchema,
  promptPreview: z.string().trim().min(1).max(4000),
  videoUrl: z.string().trim().url().optional(),
  fileSaved: z.boolean().default(false),
  progress: z.number().min(0).max(100).default(0),
  errorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
})

export const studioVideoJobContentSchema = z.object({
  provider: z.string().trim().min(1),
  providerVideoId: z.string().trim().min(1),
  estimatedCredits: z.number().int().min(1),
  propertyId: z.string().trim().min(1).optional(),
  propertyTitle: z.string().trim().min(1).optional(),
  propertyLocation: z.string().trim().min(1).optional(),
  referenceImageUrls: z.array(z.string().trim().url()).max(12).default([]),
  uploadedImages: z.array(studioVideoUploadSchema).max(12).default([]),
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
  errorMessage: z.string().trim().max(400).optional(),
  noticeMessage: z.string().trim().max(200).optional(),
})

export type StudioVideoRequest = z.infer<typeof studioVideoRequestSchema>
export type StudioVideoResult = z.infer<typeof studioVideoResultSchema>
export type StudioVideoJobContent = z.infer<typeof studioVideoJobContentSchema>

export function getStudioVideoDurationLabel(duration: StudioVideoDuration) {
  return studioVideoSelectableDurationOptions.find((item) => item.value === duration)?.label ?? "9 segundos"
}

export function getStudioVideoEstimatedCredits(input: {
  duration: StudioVideoDuration
  objective: StudioVideoObjective
  transformation: StudioVideoTransformation
}) {
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
