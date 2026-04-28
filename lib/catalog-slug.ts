export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function generateUniqueSlug(
  baseValue: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const baseSlug = slugify(baseValue) || "eme"

  if (!(await exists(baseSlug))) {
    return baseSlug
  }

  let counter = 2

  while (true) {
    const candidate = `${baseSlug}-${counter}`

    if (!(await exists(candidate))) {
      return candidate
    }

    counter += 1
  }
}
