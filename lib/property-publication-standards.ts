export const PROPERTY_PUBLICATION_STANDARDS = {
  uploads: {
    maximumImageBytes: 8 * 1024 * 1024,
    supportedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  },
  marketplace: {
    minimumPhotos: 4,
    maximumPhotos: 6,
    minimumDescriptionCharacters: 100,
    minimumImageLongEdge: 1200,
    minimumImageShortEdge: 675,
    maximumImageBytes: 12 * 1024 * 1024,
    supportedFormats: ["jpeg", "png", "webp"] as const,
    imageTimeoutMs: 8_000,
  },
} as const
