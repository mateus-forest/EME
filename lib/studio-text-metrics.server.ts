import path from "node:path"
import type sharpType from "sharp"

import { escapeXml, STUDIO_FONT_ASSETS, type StudioFontWeight, type StudioTextMeasurer } from "@/lib/studio-creative-renderer"

// Server-only: rasterizes a single line via sharp's native text renderer (same technique used to
// actually draw the text in the render route) and reads back the resulting ink-bbox buffer size.
// This is deliberately NOT in lib/studio-creative-renderer.ts, which is also pulled into client
// bundles through lib/studio-campaigns-ui.ts — importing sharp/fs there would break that bundle.
export function createStudioTextMeasurer(sharp: typeof sharpType): StudioTextMeasurer {
  const cache = new Map<string, { width: number; height: number }>()

  return async (text, fontSize, fontWeight: StudioFontWeight, letterSpacingEm = 0) => {
    const normalized = text.trim()
    if (!normalized) return { width: 0, height: 0 }

    const cacheKey = `${fontWeight}:${fontSize}:${letterSpacingEm}:${normalized}`
    const cached = cache.get(cacheKey)
    if (cached) return cached

    const fontAsset = STUDIO_FONT_ASSETS[fontWeight]
    const fontfile = path.join(process.cwd(), "public", "fonts", "geist", fontAsset.file)
    const letterSpacingAttr = letterSpacingEm
      ? ` letter_spacing="${Math.round(letterSpacingEm * fontSize * 1024)}"`
      : ""
    const markup = `<span size="${Math.round(fontSize * 1024)}"${letterSpacingAttr}>${escapeXml(normalized)}</span>`

    const buffer = await sharp({
      text: { text: markup, font: fontAsset.family, fontfile, rgba: true, dpi: 72 },
    })
      .png()
      .toBuffer()

    const { width, height } = await sharp(buffer).metadata()
    const result = { width: width ?? 0, height: height ?? 0 }
    cache.set(cacheKey, result)
    return result
  }
}
