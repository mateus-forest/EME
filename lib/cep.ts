export type CepLookupResult = {
  cep: string
  street: string
  complement: string
  district: string
  city: string
  state: string
}

export async function lookupCep(cep: string) {
  const normalized = cep.replace(/\D/g, "")
  if (normalized.length !== 8) {
    throw new Error("Informe um CEP valido com 8 digitos.")
  }

  const response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`, {
    method: "GET",
    cache: "no-store",
  })

  const data = (await response.json().catch(() => null)) as
    | {
        erro?: boolean
        cep?: string
        logradouro?: string
        complemento?: string
        bairro?: string
        localidade?: string
        uf?: string
      }
    | null

  if (!response.ok || !data || data.erro) {
    throw new Error("Nao foi possivel localizar esse CEP.")
  }

  return {
    cep: data.cep ?? "",
    street: data.logradouro ?? "",
    complement: data.complemento ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  } satisfies CepLookupResult
}

export { formatCep } from "@/lib/structured-fields"
