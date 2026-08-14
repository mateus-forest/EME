import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function BeforeDeciding({
  confirmedInfo,
  toConfirm,
}: {
  confirmedInfo: string[]
  toConfirm: string[]
}) {
  return (
    <div>
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
        Antes de decidir
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Confirmadas */}
        <div className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Informações confirmadas</h3>
          </div>
          {confirmedInfo.length ? (
            <ul className="mt-4 space-y-2.5">
              {confirmedInfo.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl bg-eme-50/70 p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ainda não há informações documentais marcadas como confirmadas neste anúncio.
              </p>
            </div>
          )}
        </div>

        {/* A confirmar */}
        <div className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Pontos para confirmar</h3>
          </div>
          <ul className="mt-4 space-y-2.5">
            {toConfirm.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Mostramos o que consta no anúncio e separamos os pontos que ainda precisam ser confirmados com o profissional responsável.
      </p>
    </div>
  )
}
