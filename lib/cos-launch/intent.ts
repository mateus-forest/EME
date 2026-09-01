import type { CosLaunchIntent } from "@/lib/cos-launch/types"

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}
function includesAny(value: string, terms: string[]) { return terms.some((term) => value.includes(term)) }

export function resolveCosLaunchIntent(message: string): CosLaunchIntent {
  const value = normalize(message)
  if (!value) return "unknown"
  if (includesAny(value, ["nova conversa", "comecar de novo", "limpar conversa"])) return "new_conversation"
  const wantsCreate = includesAny(value, ["cadastrar", "cadastre", "criar", "crie", "novo", "nova", "adicionar"])
  if (wantsCreate && includesAny(value, ["recebimento", "entrada"])) return "create_financial_income"
  if (wantsCreate && includesAny(value, ["despesa", "saida", "gasto"])) return "create_financial_expense"
  if (wantsCreate && value.includes("comissao")) return "create_financial_commission"
  if (includesAny(value, ["anexar documento", "adicionar documento", "enviar documento"])) return "attach_document"
  if (wantsCreate && includesAny(value, ["cliente", "lead", "contato"])) return "create_client"
  if (wantsCreate && includesAny(value, ["imovel", "casa", "apartamento"])) return "create_property"
  if (wantsCreate && value.includes("proposta")) return "create_proposal"
  if (wantsCreate && value.includes("contrato")) return "create_contract"
  if (wantsCreate && includesAny(value, ["compromisso", "agenda", "visita", "reuniao"])) return "create_agenda"
  const wantsHelp = includesAny(value, ["ajuda", "como funciona", "como usar", "como faco", "duvida", "explique"])
  if (wantsHelp && includesAny(value, ["locacao no financeiro", "locacoes no financeiro", "aluguel no financeiro"])) return "help_finance_rentals"
  if (wantsHelp && includesAny(value, ["valor da carteira", "carteira no financeiro"])) return "help_finance_portfolio"
  if (wantsHelp && includesAny(value, ["recebimento", "despesa", "entrada", "saida"])) return "help_finance_entries"
  if (wantsHelp && value.includes("comissao")) return "help_finance_commissions"
  if (wantsHelp && includesAny(value, ["conta financeira", "contas financeiras", "contas no financeiro"])) return "help_finance_accounts"
  if (wantsHelp && value.includes("financeiro")) return "help_finance"
  if (wantsHelp && includesAny(value, ["plano", "conta", "faturamento", "assinatura", "credito", "capacidade", "pagamento", "cancelamento"])) return "help_plan_account"
  if (wantsHelp && value.includes("imovel")) return "help_properties"
  if (wantsHelp && includesAny(value, ["cliente", "lead"])) return "help_clients"
  if (wantsHelp && value.includes("contrato")) return "help_contracts"
  if (wantsHelp && value.includes("proposta")) return "help_proposals"
  if (wantsHelp && includesAny(value, ["studio", "campanha"])) return "help_studio"
  if (wantsHelp && value.includes("catalogo")) return "help_catalog"
  if (wantsHelp && value.includes("marketplace")) return "help_marketplace"
  if (wantsHelp || includesAny(value, ["o que voce faz", "o que o cos faz"])) return "help_cos"
  if (includesAny(value, ["proximos recebimentos", "recebimentos dos proximos", "previsao de recebimentos"])) return "financial_upcoming"
  if (includesAny(value, ["valor da carteira", "quanto vale minha carteira"])) return "financial_portfolio"
  if (includesAny(value, ["minhas comissoes", "listar comissoes", "ver comissoes", "comissoes atrasadas"])) return "financial_commissions"
  if (includesAny(value, ["minhas despesas", "listar despesas", "ver despesas", "quanto gastei"])) return "financial_expenses"
  if (includesAny(value, ["meus recebimentos", "listar recebimentos", "ver recebimentos", "quanto recebi"])) return "financial_receipts"
  if (includesAny(value, ["minhas contas financeiras", "contas do financeiro", "saldo das contas"])) return "financial_accounts"
  if (includesAny(value, ["resumo financeiro", "meu financeiro", "financeiro operacional"])) return "financial_summary"
  if (includesAny(value, ["agenda de hoje", "compromissos de hoje", "meus compromissos", "minha agenda"])) return "agenda_today"
  if (includesAny(value, ["meus imoveis", "listar imoveis", "ver imoveis", "imoveis"])) return "list_properties"
  if (includesAny(value, ["meus clientes", "listar clientes", "ver clientes", "clientes", "leads"])) return "list_clients"
  if (includesAny(value, ["meus contratos", "listar contratos", "ver contratos", "contratos"])) return "list_contracts"
  if (includesAny(value, ["minhas propostas", "listar propostas", "ver propostas", "propostas"])) return "list_proposals"
  if (includesAny(value, ["meus documentos", "listar documentos", "ver documentos", "documentos"])) return "list_documents"
  if (includesAny(value, ["studio", "campanha"])) return "help_studio"
  if (value.includes("catalogo")) return "help_catalog"
  if (value.includes("marketplace")) return "help_marketplace"
  return "unknown"
}
