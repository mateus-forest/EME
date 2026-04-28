export type AgencyBrokerProperty = {
  id: string
  title: string
  location: string
  price: string
  status: string
  image: string
}

export type AgencyBroker = {
  id: string
  userId: string
  initials: string
  name: string
  creci: string
  email: string
  whatsApp: string
  catalogLink: string
  properties: number
  views: string
  clicks: string
  leads: number
  status: string
  highlight: string
  actionLabel: string
  secondaryAction: string
  recentProperties: AgencyBrokerProperty[]
}
