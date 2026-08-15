import { expect, test } from "@playwright/test"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

import {
  getCosDomainLabel,
  getCosInteractionLabel,
  getCosStatusLabel,
  repairLegacyCosText,
} from "@/lib/cos/localization"

const MOJIBAKE = /(?:Ãƒ|Ã¢|Ã£|Ã§|Ã©|Ãª|Ã­|Ã³|Ã´|Ãº|Â|âœ|âš|â‚|â|â¬)/
const TECHNICAL_STATUS = /\b(?:pending|completed|failed|awaiting_input|needs_confirmation|needs_clarification|processing)\b/i

function listTypeScriptFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(path, entry.name)
    if (entry.isDirectory()) return listTypeScriptFiles(absolute)
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : []
  })
}

test.describe("COS — localização pt-BR", () => {
  test("centraliza nomes de domínio conforme o glossário do EME", () => {
    expect(getCosDomainLabel("lead")).toBe("Clientes")
    expect(getCosDomainLabel("property")).toBe("Imóveis")
    expect(getCosDomainLabel("agenda")).toBe("Compromissos")
    expect(getCosDomainLabel("catalog")).toBe("Catálogo")
    expect(getCosDomainLabel("marketplace")).toBe("Marketplace")
    expect(getCosDomainLabel("studio")).toBe("Studio IA")
  })

  test("localiza status por namespace sem confundir documento e contrato", () => {
    expect(getCosStatusLabel("action", "needs_confirmation")).toBe("Aguardando confirmação")
    expect(getCosStatusLabel("workflow", "failed")).toBe("Não concluído")
    expect(getCosStatusLabel("lead", "NEGOTIATING")).toBe("Em negociação")
    expect(getCosStatusLabel("property", "PUBLISHED")).toBe("Publicado")
    expect(getCosStatusLabel("agenda", "done")).toBe("Concluído")
    expect(getCosStatusLabel("contract", "awaiting_signature")).toBe("Aguardando assinatura")
    expect(getCosStatusLabel("contract", "completed")).toBe("Finalizado")
    expect(getCosStatusLabel("document", "generated")).toBe("Gerado")
    expect(getCosStatusLabel("document", "archived")).toBe("Arquivado")
    expect(getCosStatusLabel("studio", "PENDING_REVIEW")).toBe("Em análise")
  })

  test("status desconhecido não é devolvido cru ao usuário", () => {
    const label = getCosStatusLabel("document", "brand_new_internal_status")

    expect(label).not.toContain("brand_new_internal_status")
    expect(label).not.toMatch(TECHNICAL_STATUS)
    expect(label.trim().length).toBeGreaterThan(0)
  })

  test("centraliza labels de interação com acentuação correta", () => {
    expect(getCosInteractionLabel("confirmation")).toBe("Confirmação")
    expect(getCosInteractionLabel("selection")).toBe("Seleção")
    expect(getCosInteractionLabel("navigation")).toBe("Navegação")
    expect(getCosInteractionLabel("wizard")).toBe("Próximo passo")
    expect(getCosInteractionLabel("preview")).toBe("Prévia")
    expect(getCosInteractionLabel("summary")).toBe("Resumo")
    expect(getCosInteractionLabel("result")).toBe("Resultado")
  })

  test("adapter legado corrige somente mojibake conhecido", () => {
    expect(repairLegacyCosText("NÃƒÂ£o consegui abrir o imÃƒÂ³vel. OperaÃƒÂ§ÃƒÂ£o interrompida."))
      .toBe("Não consegui abrir o imóvel. Operação interrompida.")
    expect(repairLegacyCosText("NÃ£o consegui concluir a operaÃ§Ã£o."))
      .toBe("Não consegui concluir a operação.")

    const legitimate = "Naomi criou uma ação no EME."
    expect(repairLegacyCosText(legitimate)).toBe(legitimate)
  })

  test("fontes do runtime do portal não contêm mojibake", () => {
    const root = process.cwd()
    const files = [
      ...listTypeScriptFiles(join(root, "app", "api", "assistant", "eme")),
      ...listTypeScriptFiles(join(root, "lib", "cos")),
      join(root, "components", "use-cos-conversations.ts"),
      join(root, "components", "cos-pending-action.tsx"),
    ].filter((file) => !file.endsWith(`${join("lib", "cos", "localization.ts")}`))

    const failures = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/)
      return lines.flatMap((line, index) => MOJIBAKE.test(line)
        ? [`${relative(root, file)}:${index + 1}: ${line.trim()}`]
        : [])
    })

    expect(failures, failures.join("\n")).toEqual([])
  })

  test("labels finais comuns não vazam status técnico nem encoding corrompido", () => {
    const labels = [
      getCosStatusLabel("action", "success"),
      getCosStatusLabel("action", "needs_clarification"),
      getCosStatusLabel("workflow", "awaiting_input"),
      getCosStatusLabel("workflow", "completed"),
      getCosStatusLabel("workflow", "failed"),
      getCosStatusLabel("lead", "CONTACTED"),
      getCosStatusLabel("property", "PAUSED"),
      getCosStatusLabel("agenda", "pending"),
    ]

    for (const label of labels) {
      expect(label).not.toMatch(TECHNICAL_STATUS)
      expect(label).not.toMatch(MOJIBAKE)
    }
  })
})
