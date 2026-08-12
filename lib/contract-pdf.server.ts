import PDFDocument from "pdfkit"

import { renderContractBlockText, type ContractTemplateStructure } from "@/lib/contract-template-engine"

export function generateContractPdf(input: {
  title: string
  draft: boolean
  structure: ContractTemplateStructure
  values: Record<string, string>
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 62, right: 57, bottom: 64, left: 57 },
      bufferPages: true,
      info: { Title: input.title, Author: "", Creator: "EME" },
    })
    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    document.on("end", () => resolve(Buffer.concat(chunks)))
    document.on("error", reject)

    for (const block of input.structure.blocks) {
      const text = renderContractBlockText(block, input.structure.fields, input.values)
      if (block.type === "TITLE") {
        document.moveDown(0.4).font("Times-Bold").fontSize(14).text(text, { align: "center", lineGap: 3 }).moveDown(1)
      } else if (block.type === "HEADING" || block.type === "CLAUSE") {
        document.moveDown(0.45).font("Times-Bold").fontSize(11.5).text(text, { align: "justify", lineGap: 2 }).moveDown(0.35)
      } else if (block.type === "SIGNATURE") {
        document.moveDown(1.5).font("Times-Roman").fontSize(11.5).text(text, { align: "center", lineGap: 3 }).moveDown(0.6)
      } else {
        document.font("Times-Roman").fontSize(11.5).text(text, { align: "justify", lineGap: 3 }).moveDown(0.65)
      }
    }

    const range = document.bufferedPageRange()
    for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
      document.switchToPage(pageIndex)
      if (input.draft) {
        document.save().opacity(0.07).fillColor("#222222").font("Helvetica-Bold").fontSize(62)
          .rotate(-28, { origin: [297, 420] }).text("RASCUNHO", 80, 390, { width: 435, align: "center" }).restore()
      }
      document.font("Helvetica").fontSize(8).fillColor("#777777")
        .text(`${pageIndex + 1} / ${range.count}`, 57, 797, { width: 481, align: "center" })
    }
    document.end()
  })
}
