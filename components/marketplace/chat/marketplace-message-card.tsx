import Image from 'next/image'
import Link from 'next/link'
import { Building2, FileText } from 'lucide-react'
import { formatCurrencyBRLFromCents } from '@/lib/structured-fields'

type MessageCardProps = {
  kind?: string
  body: string
  metadata?: unknown
  brokerView?: boolean
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function MarketplaceMessageCard({ kind = 'TEXT', body, metadata, brokerView = false }: MessageCardProps) {
  if (kind === 'TEXT') return <p>{body}</p>

  const data = metadataRecord(metadata)
  if (kind === 'PROPERTY') {
    const title = textValue(data.title) || 'Imóvel do Marketplace'
    const location = textValue(data.location)
    const image = textValue(data.image)
    const slug = textValue(data.slug)
    const price = typeof data.price === 'number' ? data.price : Number(data.price) || 0
    const content = (
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-[#e8ece8]">
          {image ? <Image src={image} alt="" fill sizes="64px" className="object-cover" /> : <Building2 className="absolute inset-0 m-auto h-5 w-5 text-[#7b8491]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#101828]">{title}</p>
          {location ? <p className="mt-0.5 truncate text-xs text-[#667085]">{location}</p> : null}
          {price > 0 ? <p className="mt-1 text-xs font-semibold text-[#009b3a]">{formatCurrencyBRLFromCents(price)}</p> : null}
        </div>
      </div>
    )
    return slug ? (
      <Link href={`/imoveis/imovel/${encodeURIComponent(slug)}`} target="_blank" className="block min-w-[230px] max-w-[320px] rounded-2xl border border-black/[0.08] bg-white p-3 shadow-sm transition-colors hover:border-[#009b3a]/30">
        {content}
      </Link>
    ) : <div className="min-w-[230px] max-w-[320px] rounded-2xl border border-black/[0.08] bg-white p-3 shadow-sm">{content}</div>
  }

  const title = textValue(data.title) || 'Proposta comercial'
  const propertyTitle = textValue(data.propertyTitle)
  const status = textValue(data.status)
  const statusLabel: Record<string, string> = { draft: 'Rascunho', generated: 'Gerada', signed: 'Assinada' }
  return (
    <div className="min-w-[230px] max-w-[320px] rounded-2xl border border-black/[0.08] bg-white p-3 text-[#101828] shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef9f1] text-[#009b3a]"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {propertyTitle ? <p className="mt-0.5 truncate text-xs text-[#667085]">{propertyTitle}</p> : null}
          <p className="mt-1 text-xs text-[#667085]">{statusLabel[status] || 'Proposta'}{brokerView ? ' · referência enviada' : ' · enviada pelo corretor'}</p>
        </div>
      </div>
    </div>
  )
}
