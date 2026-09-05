import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const panelSource = readFileSync(
  new URL("../components/eme/expanded-module-panel.tsx", import.meta.url),
  "utf8",
)
const shellSource = readFileSync(
  new URL("../components/eme/landing-modal-shell.tsx", import.meta.url),
  "utf8",
)
const shellStyles = readFileSync(
  new URL("../components/eme/landing-modal-shell.module.css", import.meta.url),
  "utf8",
)

function readPngSize(relativePath: string) {
  const buffer = readFileSync(new URL(relativePath, import.meta.url))
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  }
}

test("Financeiro usa artes finais distintas e recortadas no desktop e mobile", () => {
  assert.match(panelSource, /src: "\/modals\/finance-desktop-approved\.png"/)
  assert.match(panelSource, /width: 1538,[\s\S]*?height: 851/)
  assert.match(panelSource, /src: "\/modals\/finance-mobile-approved\.png"/)
  assert.match(panelSource, /width: 828,[\s\S]*?height: 1580/)
  assert.doesNotMatch(panelSource, /function FinanceModuleArtwork/)
  assert.doesNotMatch(panelSource, /FINANCE_MOCKUP_CROP/)

  assert.deepEqual(readPngSize("../public/modals/finance-desktop-approved.png"), {
    width: 1538,
    height: 851,
    colorType: 6,
  })
  assert.deepEqual(readPngSize("../public/modals/finance-mobile-approved.png"), {
    width: 828,
    height: 1580,
    colorType: 6,
  })
})

test("as quatro artes removem o backdrop capturado nos cantos arredondados", async () => {
  for (const relativePath of [
    "../public/modals/cos-desktop-approved.png",
    "../public/modals/cos-mobile-approved.png",
    "../public/modals/finance-desktop-approved.png",
    "../public/modals/finance-mobile-approved.png",
  ]) {
    const path = fileURLToPath(new URL(relativePath, import.meta.url))
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]

    assert.equal(alphaAt(0, 0), 0)
    assert.equal(alphaAt(info.width - 1, 0), 0)
    assert.equal(alphaAt(0, info.height - 1), 0)
    assert.equal(alphaAt(info.width - 1, info.height - 1), 0)
    assert.equal(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)), 255)
  }
})

test("COS e Financeiro compartilham o modo image-only sem shell visual duplicado", () => {
  assert.match(panelSource, /module\.id === "cos" \|\| module\.id === "financeiro"/)
  assert.match(panelSource, /<ApprovedModalArtwork module=\{module\} artwork=\{approvedArtwork\} compact=\{compact\} \/>/)
  assert.match(shellSource, /data-landing-modal-image-only=\{imageOnly\?\.variant\}/)
  assert.match(shellStyles, /\.imageOnly\.imageOnly[\s\S]*?background:\s*transparent !important/)
  assert.match(shellStyles, /\.imageOnly\.imageOnly[\s\S]*?box-shadow:\s*none !important/)
})

test("fechamento usa somente hotspot transparente posicionado sobre o X da arte", () => {
  assert.match(shellSource, /closeXPercent: number/)
  assert.match(shellSource, /closeYPercent: number/)
  assert.match(shellSource, /styles\.transparentClose/)
  assert.match(shellSource, /\{isImageOnly \? null : \([\s\S]*?<X/)
  assert.match(shellStyles, /\.transparentClose\.transparentClose[\s\S]*?width:\s*44px !important/)
  assert.match(shellStyles, /\.transparentClose\.transparentClose[\s\S]*?background:\s*transparent !important/)
})
