export const PROPERTY_PUBLICATION_STANDARDS = {
  uploads: {
    maximumImageBytes: 8 * 1024 * 1024,
    supportedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  },
  marketplace: {
    minimumPhotos: 1,
    recommendedPhotos: 4,
    maximumPhotos: 6,
    minimumDescriptionCharacters: 100,
    recommendedImageLongEdge: 1200,
    recommendedImageShortEdge: 675,
    maximumImageBytes: 12 * 1024 * 1024,
    supportedFormats: ["jpeg", "png", "webp"] as const,
    imageTimeoutMs: 8_000,
  },
} as const
