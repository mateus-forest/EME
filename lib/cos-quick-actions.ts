import type { CosQuickAction } from "@/components/cos-prompt-composer"

export const COS_QUICK_ACTIONS: CosQuickAction[] = [
  {
    label: "Como usar o EME",
    group: "Sistema",
    icon: "help",
    message: "Como usar o EME?",
  },
  {
    label: "Buscar cliente",
    group: "Clientes",
    icon: "client",
    message: "Qual cliente voce deseja localizar?",
  },
  {
    label: "Buscar imóvel",
    group: "Imoveis",
    icon: "property",
    message: "Qual imóvel você procura?",
  },
  {
    label: "Minha agenda",
    group: "Agenda",
    icon: "agenda",
    message: "Mostre minha agenda de hoje.",
  },
  {
    label: "Novos leads",
    group: "Leads",
    icon: "leads",
    message: "Mostre meus novos leads pendentes.",
  },
  {
    label: "Criar campanha Instagram",
    group: "Studio IA",
    icon: "instagram",
    message: "Quero criar uma campanha Instagram.",
  },
  {
    label: "Gerar vídeo do imóvel",
    group: "Studio IA",
    icon: "video",
    message: "Quero gerar um vídeo do imóvel.",
  },
]
