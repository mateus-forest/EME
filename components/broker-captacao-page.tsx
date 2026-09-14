"use client"
/* External listing text is rendered as plain React text, never HTML. */
import {
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react"
import Link from "next/link"
import {
  Search,
  ExternalLink,
  Bookmark,
  MessageSquare,
  RefreshCw,
  CalendarDays,
  Copy,
  Building2,
} from "lucide-react"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  advertiserNames,
  buildApproach,
  filterSchema,
  objectives,
  possibleDuplicates,
  propertyTypes,
  sources,
  sourceNames,
  stages,
  stageNames,
  type Capture,
  type Filters,
  type Listing,
  type Objective,
  type Source,
  type Stage,
  type AdvertiserKind,
} from "@/lib/captacao/contract"

type SourceResult = {
  source: Source
  status: "ok" | "error"
  error?: string
  code?: string
  nextPage?: number | null
  excluded?: number
  localFilters?: string[]
  checkedAt?: string
  cached?: boolean
}
type SearchResult = {
  items: Listing[]
  results: SourceResult[]
  partial: boolean
  coverage: string
}
type SavedResult = {
  configured: boolean
  items: Capture[]
  total: number
  nextOffset: number | null
  metrics: {
    saved: number
    contacts: number
    visits: number
    confirmed: number
  }
}
export async function captureApi<T>(
  url: string,
  data?: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method: data === undefined ? "GET" : method,
    credentials: "include",
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  })
  const json = await res.json()
  if (!res.ok)
    throw new Error(json.error || "Não foi possível concluir a ação.")
  return json as T
}
const base = "/api/brokers/captacao"
const selectClass =
  "h-10 w-full rounded-lg border border-[var(--broker-border)] bg-white px-3 text-sm text-[var(--broker-ink)] focus-visible:outline-2 focus-visible:outline-green-700"
export const captureDate = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(v))
    : "Não informada"
const price = (v: number | null) =>
  v === null
    ? "Preço não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v)
function Field({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--broker-muted)]">
      <label htmlFor={id}>{title}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id: string }>, { id })
        : children}
    </div>
  )
}
function OriginalLink({
  listing,
  children = "Abrir anúncio original",
}: {
  listing: Listing
  children?: ReactNode
}) {
  return (
    <a
      className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-green-800 underline-offset-4 hover:underline"
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  )
}
export function BrokerCaptacaoPage() {
  const [tab, setTab] = useState("search"),
    [saved, setSaved] = useState<SavedResult | null>(null),
    [items, setItems] = useState<Listing[]>([]),
    [sourceResults, setSourceResults] = useState<SourceResult[]>([])
  const [query, setQuery] = useState<Filters | null>(null),
    [selectedSources, setSelectedSources] = useState<Source[]>([
      "chavesnamao",
      "vivareal",
    ]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [loadError, setLoadError] = useState("")
  const [selection, setSelection] = useState<{
    listing: Listing
    capture?: Capture
    approach?: boolean
  } | null>(null)
  const { profile } = useBrokerProfile()
  async function reload(append = false) {
    try {
      const data = await captureApi<SavedResult>(
        `${base}${append && saved?.nextOffset ? `?offset=${saved.nextOffset}` : ""}`,
      )
      setSaved((old) =>
        append && old
          ? { ...data, items: [...old.items, ...data.items] }
          : data,
      )
      setLoadError("")
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }
  useEffect(() => {
    let live = true
    captureApi<SavedResult>(base)
      .then((r) => {
        if (live) setSaved(r)
      })
      .catch((e) => {
        if (live) setLoadError(e.message)
      })
    return () => {
      live = false
    }
  }, [])
  async function search(filters: Filters, chosen: Source[], page = 1) {
    setBusy(true)
    setMessage("")
    try {
      const res = await captureApi<SearchResult>(`${base}/search`, {
        filters,
        sources: chosen,
        page,
      })
      setQuery(filters)
      setItems((old) =>
        possibleDuplicates(
          page === 1
            ? res.items
            : [
                ...old,
                ...res.items.filter((x) => !old.some((y) => x.key === y.key)),
              ],
        ),
      )
      setSourceResults((old) =>
        page === 1
          ? res.results
          : [...old.filter((r) => !chosen.includes(r.source)), ...res.results],
      )
      setMessage(
        res.partial
          ? "Resultado parcial: uma ou mais fontes estão indisponíveis. Os anúncios recebidos foram preservados."
          : res.items.length === 0
            ? "Nenhum resultado exibido nesta página. Confira os filtros e os itens excluídos abaixo."
            : "Resultados das páginas consultadas. Confirme a disponibilidade com o anunciante.",
      )
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const v: Record<string, unknown> = {
      state: fd.get("state"),
      city: fd.get("city"),
      businessType: fd.get("businessType"),
      neighborhoods: String(fd.get("neighborhoods") || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      advertiser: fd.get("advertiser"),
    }
    if (fd.get("propertyType")) v.propertyType = fd.get("propertyType")
    for (const n of [
      "priceMin",
      "priceMax",
      "areaMin",
      "areaMax",
      "bedrooms",
      "parking",
    ])
      if (fd.get(n) !== "") v[n] = Number(fd.get(n))
    const parsed = filterSchema.safeParse(v)
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message)
      return
    }
    if (!selectedSources.length) {
      setMessage("Selecione pelo menos uma fonte.")
      return
    }
    void search(parsed.data, selectedSources)
  }
  async function openListing(listing: Listing, approach = false) {
    setBusy(true)
    try {
      const r = await captureApi<{ listing: Listing; capture?: Capture }>(
        `${base}/details`,
        { receipt: listing.receipt },
      )
      setSelection({
        listing: r.listing,
        capture: r.capture ?? undefined,
        approach,
      })
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function save(listing: Listing) {
    setBusy(true)
    try {
      const r = await captureApi<{ capture: Capture }>(base, {
        receipt: listing.receipt,
      })
      setSelection({ listing: r.capture.listing, capture: r.capture })
      setMessage("Oportunidade salva. Nenhum cliente ou imóvel foi criado.")
      await reload()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <BrokerPageShell
      eyebrow="Carteira · Captação"
      title="Encontre sua próxima captação."
      subtitle="Busque imóveis na sua região e prepare o próximo contato."
    >
      <div className="grid min-w-0 gap-5">
        {loadError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
          >
            {loadError}
            <Button
              variant="outline"
              onClick={() => void reload()}
              className="ml-2"
            >
              Tentar carregar
            </Button>
          </div>
        )}
        {saved && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Oportunidades salvas", saved.metrics.saved],
              ["Contatos registrados", saved.metrics.contacts],
              ["Visitas agendadas · etapa atual", saved.metrics.visits],
              ["Captações confirmadas · etapa atual", saved.metrics.confirmed],
            ].map(([label, n]) => (
              <Card key={label} className="gap-0 py-3 shadow-none">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{n}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start sm:w-auto">
            <TabsTrigger value="search">Buscar imóveis</TabsTrigger>
            <TabsTrigger value="saved">Minhas captações</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4 grid gap-4">
            {saved?.configured === false && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
              >
                <strong>Integração não configurada.</strong> A busca real estará
                disponível após configurar a GeckoAPI. Não exibimos anúncios
                simulados.
              </div>
            )}
            <Card className="shadow-none">
              <CardContent className="pt-5">
                <form onSubmit={submit} className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Field title="UF">
                      <select
                        name="state"
                        required
                        className={selectClass}
                        defaultValue="RS"
                      >
                        {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
                          .split(" ")
                          .map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                      </select>
                    </Field>
                    <Field title="Cidade">
                      <Input
                        name="city"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Ex.: Porto Alegre"
                      />
                    </Field>
                    <Field title="Finalidade">
                      <select name="businessType" className={selectClass}>
                        <option value="sale">Venda</option>
                        <option value="rent">Locação</option>
                      </select>
                    </Field>
                    <Field title="Tipo de imóvel">
                      <select name="propertyType" className={selectClass}>
                        <option value="">Todos os tipos</option>
                        {Object.entries(propertyTypes).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="col-span-2">
                      <Field title="Bairro ou bairros (separados por vírgula, até 5)">
                        <Input
                          name="neighborhoods"
                          maxLength={600}
                          placeholder="Ex.: Centro, Moinhos de Vento"
                        />
                      </Field>
                    </div>
                    <Field title="Preço mínimo (R$)">
                      <Input type="number" name="priceMin" min={0} step={1} />
                    </Field>
                    <Field title="Preço máximo (R$)">
                      <Input type="number" name="priceMax" min={0} step={1} />
                    </Field>
                  </div>
                  <details className="rounded-xl border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Filtros adicionais e cobertura
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                      {[
                        ["Quartos (quantidade)", "bedrooms"],
                        ["Vagas (quantidade)", "parking"],
                        ["Área mínima (m²)", "areaMin"],
                        ["Área máxima (m²)", "areaMax"],
                      ].map(([l, n]) => (
                        <Field key={n} title={l}>
                          <Input
                            type="number"
                            name={n}
                            min={0}
                            max={
                              ["bedrooms", "parking"].includes(n)
                                ? 20
                                : undefined
                            }
                            step={1}
                          />
                        </Field>
                      ))}
                      <Field title="Perfil do anunciante">
                        <select className={selectClass} name="advertiser">
                          <option value="any">Todos</option>
                          <option value="private">
                            Particular indicado na origem
                          </option>
                          <option value="professional">
                            Profissional identificado
                          </option>
                        </select>
                      </Field>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      VivaReal e Chaves na Mão recebem os filtros imobiliários e
                      um bairro. Com vários bairros, o EME filtra apenas as
                      páginas carregadas. No ZAP, tipo, bairros e perfil são
                      filtros locais. Na OLX, UF/cidade/preço e palavras-chave
                      vão à fonte; demais critérios dependem dos dados
                      retornados. Itens sem dados para comprovar um filtro local
                      são excluídos. Particular não comprova propriedade. A
                      busca não cobre necessariamente toda a região.
                    </p>
                  </details>
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium">Fontes</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {sources.map((s) => (
                        <label
                          key={s}
                          className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(s)}
                            onChange={(e) =>
                              setSelectedSources((old) =>
                                e.target.checked
                                  ? [...old, s]
                                  : old.filter((x) => x !== s),
                              )
                            }
                          />
                          {sourceNames[s]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={busy || !saved?.configured}>
                      <Search className="size-4" />
                      {busy ? "Consultando fontes…" : "Buscar imóveis"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Apenas ao buscar: até uma consulta por fonte/página.
                      Detalhes são consultados à parte.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
            {message && (
              <p
                role="status"
                aria-live="polite"
                className="rounded-lg bg-white p-3 text-sm"
              >
                {message}
              </p>
            )}
            {sourceResults.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {sourceResults.map((s) => (
                  <div
                    className="rounded-xl border bg-white p-3 text-xs"
                    key={s.source}
                  >
                    <strong>{sourceNames[s.source]}</strong>
                    <p className="mt-1">
                      {s.status === "error"
                        ? s.error
                        : `Consulta: ${captureDate(s.checkedAt ?? null)}${s.cached ? " · consulta recente reutilizada" : ""}. ${s.excluded ?? 0} itens não exibidos por filtros/dados insuficientes.`}
                    </p>
                    {s.localFilters?.length ? (
                      <p className="mt-1 text-muted-foreground">
                        Filtros locais: {s.localFilters.join(", ")}.
                      </p>
                    ) : null}
                    {s.status === "ok" && s.nextPage && query && (
                      <Button
                        className="mt-2"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void search(query, [s.source], s.nextPage!)
                        }
                      >
                        Carregar página {s.nextPage}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => (
                <ListingCard
                  key={l.key}
                  listing={l}
                  busy={busy}
                  onDetail={() => void openListing(l)}
                  onApproach={() => void openListing(l, true)}
                  onSave={() => void save(l)}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="saved" className="mt-4 grid gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Acompanhe ações registradas e próximos passos.
              </p>
              <Button variant="ghost" onClick={() => void reload()}>
                <RefreshCw className="size-4" />
                Atualizar
              </Button>
            </div>
            {!saved && !loadError && <p role="status">Carregando captações…</p>}
            {saved?.total === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma oportunidade salva. Comece pela busca de imóveis.
                </CardContent>
              </Card>
            )}
            {saved?.items.map((c) => (
              <Card key={c.id} className="py-4 shadow-none">
                <CardContent className="flex flex-wrap items-start justify-between gap-3 px-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-green-800">
                      {stageNames[c.stage]} · {sourceNames[c.listing.source]}
                    </p>
                    <h2 className="mt-1 break-words text-base font-semibold">
                      {c.listing.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {price(c.listing.price)} · {c.listing.neighborhood}{" "}
                      {c.listing.city}
                    </p>
                    {c.doNotContact && (
                      <p className="mt-1 text-sm font-semibold text-red-700">
                        Não deseja contato
                      </p>
                    )}
                    {c.nextAction && (
                      <p className="mt-2 text-xs">
                        Próxima ação: {c.nextAction} · {captureDate(c.dueAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSelection({ listing: c.listing, capture: c })
                    }
                  >
                    Acompanhar
                  </Button>
                </CardContent>
              </Card>
            ))}
            {saved?.nextOffset !== null && saved?.nextOffset !== undefined && (
              <Button variant="outline" onClick={() => void reload(true)}>
                Carregar mais captações
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {selection && (
        <CaptureDialog
          key={selection.capture?.id ?? selection.listing.key}
          selection={selection}
          brokerName={profile.fullName || ""}
          onClose={() => setSelection(null)}
          onSaved={async (c) => {
            setSelection({ listing: c.listing, capture: c })
            await reload()
          }}
        />
      )}
    </BrokerPageShell>
  )
}
function ListingCard({
  listing: l,
  busy,
  onDetail,
  onSave,
  onApproach,
}: {
  listing: Listing
  busy: boolean
  onDetail: () => void
  onSave: () => void
  onApproach: () => void
}) {
  return (
    <Card className="gap-0 overflow-clip py-0 shadow-none">
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-slate-100">
        {l.image ? (
          <img
            src={l.image}
            alt="Foto do anúncio de origem"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Foto não disponível
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-xs font-medium">
          {sourceNames[l.source]}
        </span>
      </div>
      <CardContent className="grid gap-2 p-4">
        <h2 className="text-base font-semibold leading-6">{l.title}</h2>
        <p className="font-semibold">{price(l.price)}</p>
        <p className="text-xs text-muted-foreground">
          {[l.neighborhood, l.city, l.state].filter(Boolean).join(" · ")}
        </p>
        <p className="text-xs">
          {l.area ?? "—"} m² · {l.bedrooms ?? "—"} quartos · {l.parking ?? "—"}{" "}
          vagas
        </p>
        <p className="text-xs">{advertiserNames[l.advertiser.kind]}</p>
        <p className="text-xs text-muted-foreground">
          Disponibilidade a confirmar.
        </p>
        {l.matches.length > 0 && (
          <p className="text-xs text-green-800">{l.matches.join(" · ")}</p>
        )}
        {!!l.possibleDuplicates?.length && (
          <p className="text-xs font-medium text-amber-700">
            Possível anúncio duplicado em outra fonte. Compare os dados; os
            anúncios não foram unidos.
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={onDetail}>
            Ver detalhes
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onSave}>
            <Bookmark className="size-3.5" />
            Salvar captação
          </Button>
          <Button size="sm" variant="ghost" onClick={onApproach}>
            Preparar abordagem
          </Button>
        </div>
        <OriginalLink listing={l} />
      </CardContent>
    </Card>
  )
}
function CaptureDialog({
  selection,
  brokerName,
  onClose,
  onSaved,
}: {
  selection: { listing: Listing; capture?: Capture; approach?: boolean }
  brokerName: string
  onClose: () => void
  onSaved: (c: Capture) => Promise<void>
}) {
  const [listing, setListing] = useState(selection.listing),
    [capture, setCapture] = useState(selection.capture),
    [panel, setPanel] = useState(selection.approach ? "approach" : "details"),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false)
  const [note, setNote] = useState(""),
    [stage, setStage] = useState<Stage>(capture?.stage ?? "SAVED"),
    [nextAction, setNextAction] = useState(capture?.nextAction ?? ""),
    [date, setDate] = useState(""),
    [visit, setVisit] = useState(false),
    [kind, setKind] = useState<AdvertiserKind>(
      capture?.advertiserKind ?? listing.advertiser.kind,
    )
  const [objective, setObjective] = useState<Objective>("availability"),
    [brokerCity, setBrokerCity] = useState(""),
    [name, setName] = useState(brokerName)
  const hasConversation = Boolean(
    capture?.activities.some((a) => a.action === "CONTACT"),
  )
  const effectiveKind = capture?.advertiserKind ?? listing.advertiser.kind
  const guidance = buildApproach(
    listing,
    effectiveKind,
    objective,
    name,
    brokerCity,
    hasConversation,
  )
  const [message, setMessage] = useState(guidance.message)
  async function action(task: () => Promise<void>) {
    setBusy(true)
    setError("")
    setInfo("")
    try {
      await task()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function mutate(data: Record<string, unknown>) {
    if (!capture) return
    await action(async () => {
      const r = await captureApi<{ capture: Capture }>(
        `${base}/${capture.id}`,
        { operationKey: crypto.randomUUID(), ...data },
        "PATCH",
      )
      setCapture(r.capture)
      setStage(r.capture.stage)
      setNote("")
      setInfo("Registro salvo.")
      await onSaved(r.capture)
    })
  }
  async function refresh() {
    await action(async () => {
      const r = await captureApi<{ listing: Listing }>(`${base}/details`, {
        ...(capture ? { captureId: capture.id } : { receipt: listing.receipt }),
        refresh: true,
      })
      setListing(r.listing)
      if (capture) {
        const updated = await captureApi<{ capture: Capture }>(
          `${base}/${capture.id}`,
          {
            action: "refresh",
            operationKey: crypto.randomUUID(),
            receipt: r.listing.receipt,
          },
          "PATCH",
        )
        setCapture(updated.capture)
        await onSaved(updated.capture)
      }
      setInfo("Detalhes consultados na origem.")
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="broker-portal-scope text-[var(--broker-ink)] flex max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-3 overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="leading-6">{listing.title}</DialogTitle>
          <DialogDescription>
            {sourceNames[listing.source]} · Anúncio encontrado; disponibilidade
            a confirmar.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="min-w-0">
          <Tabs value={panel} onValueChange={setPanel}>
            <TabsList className="h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="approach">Preparar abordagem</TabsTrigger>
              {capture && (
                <TabsTrigger value="tracking">Acompanhamento</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="details" className="grid gap-3 py-2">
              {listing.image && (
                <img
                  src={listing.image}
                  alt="Foto do anúncio original"
                  referrerPolicy="no-referrer"
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
              <p className="text-lg font-semibold">{price(listing.price)}</p>
              <p className="text-sm">
                {[listing.neighborhood, listing.city, listing.state]
                  .filter(Boolean)
                  .join(" · ")}
                <br />
                {listing.area ?? "—"} m² · {listing.bedrooms ?? "—"} quartos ·{" "}
                {listing.parking ?? "—"} vagas
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {listing.description ||
                  "Descrição não fornecida nesta consulta."}
              </p>
              <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6">
                <p>Publicação na origem: {captureDate(listing.publishedAt)}</p>
                <p>
                  Última consulta pelo EME: {captureDate(listing.checkedAt)}
                </p>
                <p>
                  {advertiserNames[effectiveKind]}
                  {listing.advertiser.name
                    ? ` · ${listing.advertiser.name}`
                    : ""}
                </p>
                <p>
                  {capture?.identityEvidence || listing.advertiser.evidence}
                </p>
                <p>
                  {listing.advertiser.phone
                    ? `Contato disponível na origem: +${listing.advertiser.phone}`
                    : listing.advertiser.contactUnavailable}
                </p>
              </div>
              <OriginalLink listing={listing} />
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void refresh()}
              >
                <RefreshCw className="size-4" />
                Consultar detalhes na origem
              </Button>
              <p className="text-xs text-muted-foreground">
                Esta ação pode consumir uma consulta adicional do fornecedor.
                Fotos e descrições não são copiadas para a carteira.
              </p>
              {!capture && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const r = await captureApi<{ capture: Capture }>(base, {
                        receipt: listing.receipt,
                      })
                      setCapture(r.capture)
                      await onSaved(r.capture)
                      setPanel("tracking")
                    })
                  }
                >
                  <Bookmark className="size-4" />
                  Salvar captação
                </Button>
              )}
            </TabsContent>
            <TabsContent value="approach" className="grid gap-4 py-2">
              {capture?.doNotContact ? (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
                >
                  Este anunciante não deseja contato. Prepare uma nova abordagem
                  somente após registrar a mudança dessa condição.
                </div>
              ) : (
                <>
                  <section>
                    <h3 className="text-sm font-semibold">
                      1. Resumo da oportunidade
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {guidance.summary}
                    </p>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold">
                      2. O que confirmar
                    </h3>
                    <ul className="mt-1 list-inside list-disc text-sm leading-6 text-muted-foreground">
                      {guidance.confirm.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h3 className="text-sm font-semibold">
                      3. Estratégia de contato
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {guidance.strategy}
                    </p>
                  </section>
                  <section className="grid gap-3">
                    <h3 className="text-sm font-semibold">
                      4. Mensagem sugerida
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field title="Seu nome">
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={120}
                        />
                      </Field>
                      <Field title="Sua cidade de atuação (opcional)">
                        <Input
                          value={brokerCity}
                          onChange={(e) => setBrokerCity(e.target.value)}
                          maxLength={120}
                        />
                      </Field>
                    </div>
                    <Field title="Objetivo do contato">
                      <select
                        className={selectClass}
                        value={objective}
                        onChange={(e) =>
                          setObjective(e.target.value as Objective)
                        }
                      >
                        {Object.entries(objectives).map(([k, v]) => (
                          <option
                            key={k}
                            value={k}
                            disabled={k === "followup" && !hasConversation}
                          >
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Button
                      variant="outline"
                      onClick={() => setMessage(guidance.message)}
                    >
                      Atualizar sugestão com estes dados
                    </Button>
                    <Field title="Revise e edite antes de usar">
                      <Textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={4000}
                        rows={6}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void action(async () => {
                            await navigator.clipboard.writeText(message)
                            setInfo(
                              "Texto copiado. Isso não registra uma mensagem enviada.",
                            )
                          })
                        }
                      >
                        <Copy className="size-4" />
                        Copiar mensagem
                      </Button>
                      {listing.advertiser.phone &&
                      listing.advertiser.phoneSource ? (
                        <a
                          className="inline-flex min-h-10 items-center rounded-lg bg-green-800 px-4 text-sm font-medium text-white"
                          href={`https://wa.me/${listing.advertiser.phone}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir WhatsApp
                        </a>
                      ) : (
                        <OriginalLink listing={listing}>
                          Contatar pelo anúncio original
                        </OriginalLink>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Modelos contextuais, sem geração automática por IA. Copiar
                      ou abrir o WhatsApp não significa envio. Confirme o
                      contato realizado no acompanhamento.
                    </p>
                    {!capture ? (
                      <p className="text-sm">
                        Salve a oportunidade em Detalhes para registrar
                        atividades.
                      </p>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setPanel("tracking")}
                      >
                        <MessageSquare className="size-4" />
                        Registrar contato realizado
                      </Button>
                    )}
                  </section>
                </>
              )}
            </TabsContent>
            {capture && (
              <TabsContent value="tracking" className="grid gap-4 py-2">
                <p className="text-sm font-medium">
                  Etapa atual: {stageNames[capture.stage]}
                  {capture.doNotContact ? " · Não deseja contato" : ""}
                </p>
                <Field title="Observação / resumo do contato / evidência da confirmação">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={4000}
                    rows={3}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || !note.trim()}
                    onClick={() => void mutate({ action: "note", note })}
                  >
                    Salvar observação
                  </Button>
                  <Button
                    disabled={busy || !note.trim() || capture.doNotContact}
                    onClick={() => void mutate({ action: "contact", note })}
                  >
                    Confirmar contato realizado
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-44 flex-1">
                    <Field title="Etapa">
                      <select
                        value={stage}
                        onChange={(e) => setStage(e.target.value as Stage)}
                        className={selectClass}
                      >
                        {stages.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={s === "CONTACTED"}
                          >
                            {stageNames[s]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy || stage === "CONTACTED"}
                    onClick={() =>
                      void mutate({ action: "stage", stage, note })
                    }
                  >
                    Confirmar mudança de etapa
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao confirmar a captação, registre como obteve a autorização.
                  Agende a visita abaixo para entrar nessa etapa.
                </p>
                <details className="rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Identificação e preferência de contato
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <Field title="Identidade confirmada por você">
                      <select
                        value={kind}
                        onChange={(e) =>
                          setKind(e.target.value as AdvertiserKind)
                        }
                        className={selectClass}
                      >
                        {Object.entries(advertiserNames).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Button
                      disabled={busy || note.trim().length < 5}
                      variant="outline"
                      onClick={() =>
                        void mutate({
                          action: "identity",
                          advertiserKind: kind,
                          note,
                        })
                      }
                    >
                      Registrar identificação e evidência
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Use o campo de observação acima para descrever a
                      evidência. Não basta o anúncio indicar particular.
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        void mutate({
                          action: "privacy",
                          doNotContact: !capture.doNotContact,
                          note,
                        })
                      }
                    >
                      {capture.doNotContact
                        ? "Registrar autorização para novo contato"
                        : "Registrar: não deseja contato"}
                    </Button>
                  </div>
                </details>
                <section className="grid gap-3 rounded-xl border p-3">
                  <h3 className="text-sm font-semibold">
                    Próxima ação · Agenda existente
                  </h3>
                  <Field title="Próxima ação">
                    <Input
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      maxLength={160}
                    />
                  </Field>
                  <Field title="Data e horário (America/Sao_Paulo)">
                    <Input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visit}
                      onChange={(e) => setVisit(e.target.checked)}
                    />
                    É uma visita agendada
                  </label>
                  <Button
                    disabled={
                      busy ||
                      !date ||
                      !nextAction.trim() ||
                      capture.doNotContact
                    }
                    variant="outline"
                    onClick={() =>
                      void mutate({
                        action: "schedule",
                        nextAction,
                        dueAt: new Date(`${date}:00-03:00`).toISOString(),
                        ...(visit ? { stage: "VISIT" } : {}),
                        note,
                      })
                    }
                  >
                    <CalendarDays className="size-4" />
                    {capture.agendaEventId
                      ? "Atualizar compromisso"
                      : "Salvar na Agenda"}
                  </Button>
                  {capture.nextAction && (
                    <p className="text-xs">
                      {capture.nextAction} · {captureDate(capture.dueAt)}
                    </p>
                  )}
                  <Link
                    className="text-sm text-green-800 underline"
                    href="/corretor/agenda"
                  >
                    Abrir Compromissos
                  </Link>
                </section>
                {capture.stage === "CONFIRMED" &&
                  (capture.propertyId ? (
                    <Link
                      href={`/corretor/imoveis/${capture.propertyId}`}
                      className="text-sm font-semibold text-green-800 underline"
                    >
                      Ver imóvel associado na carteira
                    </Link>
                  ) : (
                    <Button asChild>
                      <Link href={`/corretor/captacao/${capture.id}/adicionar`}>
                        <Building2 className="size-4" />
                        Adicionar à carteira com revisão
                      </Link>
                    </Button>
                  ))}
                <section>
                  <h3 className="text-sm font-semibold">
                    Histórico de atividades
                  </h3>
                  <ol className="mt-2 grid gap-2">
                    {capture.activities.map((a) => (
                      <li
                        className="break-words rounded-lg bg-slate-50 p-3 text-sm"
                        key={a.id}
                      >
                        <p className="text-xs text-muted-foreground">
                          {captureDate(a.createdAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{a.note}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Últimas 100 atividades; o histórico completo permanece
                    armazenado.
                  </p>
                </section>
              </TabsContent>
            )}
          </Tabs>
        </fieldset>
        {busy && (
          <p role="status" className="text-sm">
            Processando…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {info && (
          <p
            role="status"
            className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
          >
            {info}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
