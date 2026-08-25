import "server-only"
import type { CosLaunchForm, CosLaunchFormKind } from "@/lib/cos-launch/types"
import { getFormOptions } from "@/lib/cos-launch/queries"

const copy: Record<CosLaunchFormKind, Pick<CosLaunchForm, "title" | "description" | "submitLabel">> = {
  property: { title: "Cadastrar imóvel", description: "Preencha os dados disponíveis. Informações avançadas podem ser concluídas depois.", submitLabel: "Cadastrar imóvel" },
  client: { title: "Cadastrar cliente", description: "Registre o contato e, se quiser, relacione um imóvel da carteira.", submitLabel: "Cadastrar cliente" },
  proposal: { title: "Criar proposta", description: "Selecione cliente e imóvel e informe as condições principais.", submitLabel: "Criar proposta" },
  contract: { title: "Criar contrato", description: "O COS criará um rascunho para revisão no EME.", submitLabel: "Criar contrato" },
  agenda: { title: "Criar compromisso", description: "Registre data, horário e vínculos opcionais na agenda interna.", submitLabel: "Criar compromisso" },
  document: { title: "Anexar documento", description: "Nesta versão, o COS anexa documentos PDF a clientes cadastrados.", submitLabel: "Anexar documento" },
}
export async function buildCosLaunchForm(brokerId: string, kind: CosLaunchFormKind): Promise<CosLaunchForm> { const options = kind === "property" ? { clients: [], properties: [] } : await getFormOptions(brokerId); return { kind, ...copy[kind], clients: kind === "client" || kind === "property" ? undefined : options.clients, properties: kind === "document" || kind === "property" ? undefined : options.properties } }
