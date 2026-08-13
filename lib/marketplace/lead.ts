// Estrutura demonstrativa do lead de interesse em um imóvel.
// Preparada para, futuramente:
//  1. cadastrar o visitante como cliente no EME;
//  2. registrar o imóvel e a origem do contato;
//  3. qualificar o lead pelas respostas opcionais;
//  4. abrir o WhatsApp da corretora com uma mensagem natural.
// Nesta etapa nada é enviado — apenas montamos os dados localmente.

export type LeadOrigin = 'pagina-imovel' | 'card-corretora' | 'cta-mobile' | 'contato-rapido'

export type LeadQualification = {
  financiamento?: boolean
  querVisitar?: boolean
  precisaVender?: boolean
}

export type Lead = {
  name: string
  whatsapp: string
  propertySlug: string
  propertyTitle: string
  propertyCode: string
  origin: LeadOrigin
  qualification: LeadQualification
  createdAt: string
}

const qualificationLabels: { key: keyof LeadQualification; label: string }[] = [
  { key: 'financiamento', label: 'tenho interesse em financiamento' },
  { key: 'querVisitar', label: 'gostaria de agendar uma visita' },
  { key: 'precisaVender', label: 'preciso vender outro imóvel' },
]

// Monta uma mensagem natural para a corretora, sem parecer um formulário.
export function buildWhatsappMessage(lead: Pick<Lead, 'name' | 'propertyTitle' | 'propertyCode' | 'qualification'>): string {
  const extras = qualificationLabels
    .filter(({ key }) => lead.qualification[key])
    .map(({ label }) => label)

  let message = `Olá! Sou ${lead.name || 'um interessado'} e vi a ${lead.propertyTitle} (cód. ${lead.propertyCode}) no EME. Gostaria de saber mais sobre este imóvel.`

  if (extras.length === 1) {
    message += ` Além disso, ${extras[0]}.`
  } else if (extras.length > 1) {
    const last = extras[extras.length - 1]
    message += ` Além disso, ${extras.slice(0, -1).join(', ')} e ${last}.`
  }

  return message
}

// Registro demonstrativo — mantém a interface preparada para futura integração com o CRM.
export function registerLead(lead: Lead): void {
  void lead
}
