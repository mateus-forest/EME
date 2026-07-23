/** Natural, varied proposals rendered over the propostas sidebar so the demo
 *  never looks like a dev environment. Sizes use cqw units so the overlay
 *  scales perfectly with the underlying screenshot. Wrap in an @container. */
const LIST = [
  { title: 'Apartamento Alto Padrão', meta: 'Proposta · Gerado · Helena' },
  { title: 'Cobertura Atlântica', meta: 'Proposta · Gerado · Rafael' },
  { title: 'Sala Comercial Centro', meta: 'Proposta · Rascunho · Bruno' },
  { title: 'Casa Alphaville', meta: 'Proposta · Gerado · Marina', active: true },
  { title: 'Garden Bela Vista', meta: 'Proposta · Gerado · Otávio' },
  { title: 'Apartamento Vista Parque', meta: 'Proposta · Gerado · Camila' },
]

export function ProposalList() {
  return (
    <div className="absolute left-[2.4%] top-[30%] bottom-0 w-[30%] overflow-hidden bg-card">
      <div className="flex flex-col gap-[1.1cqw]">
        {LIST.map((p) => (
          <div
            key={p.title}
            className={`rounded-[1.4cqw] border px-[1.7cqw] py-[1.35cqw] ${
              p.active ? 'border-brand/40 bg-brand/10' : 'border-border/70 bg-card'
            }`}
          >
            <p className="text-[1.15cqw] font-semibold leading-tight text-foreground">{p.title}</p>
            <p className="mt-[0.4cqw] text-[0.92cqw] leading-tight text-muted-foreground">{p.meta}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
