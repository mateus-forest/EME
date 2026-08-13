// Contrato do interesse originado no Marketplace. O registro é persistido
// no fluxo de Clientes/Leads antes de encaminhar o visitante ao WhatsApp.

import { createPublicLead } from '@/lib/lead-client'

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
  propertyId: string
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

export async function registerLead(lead: Lead) {
  const selectedQualifications = qualificationLabels
    .filter(({ key }) => lead.qualification[key])
    .map(({ label }) => label)
  return createPublicLead({
    propertyId: lead.propertyId,
    source: 'marketplace',
    name: lead.name,
    phone: lead.whatsapp,
    message: buildWhatsappMessage(lead),
    intent: [lead.origin, ...selectedQualifications].join(' | '),
  })
}
