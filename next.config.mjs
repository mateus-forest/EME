/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDFKit resolves its bundled AFM font metrics from its package directory at
  // runtime. Bundling it into a Next route rewrites that path and makes real PDF
  // requests fail with ENOENT even though in-process tests pass.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/assistant/eme": ["./knowledge/eme/**/*.md"],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
