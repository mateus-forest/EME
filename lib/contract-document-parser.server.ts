import mammoth from "mammoth"
import { extractText } from "unpdf"

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
      // This parser uses unpdf's serverless PDF.js build. Text extraction does not
      // initialize @napi-rs/canvas, DOMMatrix or Path2D because no page is rendered.
      const parsed = await extractText(new Uint8Array(buffer), { mergePages: true })
      text = parsed.text
    } else {
      const parsed = await mammoth.extractRawText({ buffer })
      text = parsed.value
    }
  } catch (error) {
    console.error("[contracts][template-parser] extraction failed", {
      fileName: file.name,
      mimeType,
      message: error instanceof Error ? error.message : "unknown",
    })
    throw new Error(mimeType === PDF_MIME ? "Não foi possível ler este PDF." : "Não foi possível ler este DOCX.", { cause: error })
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
