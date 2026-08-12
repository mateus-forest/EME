import mammoth from "mammoth"

const PDF_MIME = "application/pdf"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_TEXT_LENGTH = 140_000

export function detectContractTemplateMime(file: Pick<File, "name" | "type">) {
  const extension = file.name.toLowerCase().split(".").pop()
  if (file.type === PDF_MIME || extension === "pdf") return PDF_MIME
  if (file.type === DOCX_MIME || extension === "docx") return DOCX_MIME
  return null
}

export function validateContractTemplateFile(file: File) {
  const mimeType = detectContractTemplateMime(file)
  if (!mimeType) throw new Error("Envie um arquivo PDF ou DOCX válido.")
  if (!file.size) throw new Error("O arquivo enviado está vazio.")
  if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo deve ter no máximo 15 MB.")
  return mimeType
}

export async function extractContractTemplateText(file: File) {
  const mimeType = validateContractTemplateFile(file)
  const buffer = Buffer.from(await file.arrayBuffer())
  let text: string

  try {
    if (mimeType === PDF_MIME) {
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
      const loadingTask = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
      const document = await loadingTask.promise
      const pages: string[] = []
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "))
        page.cleanup()
      }
      text = pages.join("\n\n")
      await document.cleanup()
      await loadingTask.destroy()
    } else {
      const parsed = await mammoth.extractRawText({ buffer })
      text = parsed.value
    }
  } catch {
    throw new Error(mimeType === PDF_MIME ? "Não foi possível ler este PDF." : "Não foi possível ler este DOCX.")
  }

  const normalized = text.split("\u0000").join("").trim()
  if (normalized.length < 80) {
    throw new Error(
      mimeType === PDF_MIME
        ? "O PDF não possui texto legível. Envie uma versão com texto selecionável."
        : "O DOCX não possui conteúdo textual suficiente para preparar o modelo.",
    )
  }
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new Error("O documento é extenso demais para análise segura. Divida o modelo ou envie uma versão menor.")
  }
  return { text: normalized, mimeType }
}
