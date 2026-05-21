import { UserRole } from "@/lib/prisma-enums"

import { NextRequest,
  NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { deletePropertyImageFile, savePropertyImage } from "@/lib/property-storage"
import { serializeProperty } from "@/lib/property-contract"
import { prisma } from "@/lib/prisma"

const propertyInclude = {
  broker: {
    include: {
      user: true,
    },
  },
  agency: true,
  _count: {
    select: {
      leads: true,
    },
  },
} as const

export const dynamic = "force-dynamic"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"])
const MAX_FILES_PER_REQUEST = 6
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024

async function resolveAccessibleProperty(id: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  })

  if (!property) {
    return {
      error: NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 }),
      property: null,
    }
  }

  if (user.role === UserRole.BROKER) {
    if (!user.broker || property.brokerId !== user.broker.id) {
      return {
        error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }),
        property: null,
      }
    }
  }

  if (user.role === UserRole.AGENCY) {
    if (!user.ownedAgency || property.agencyId !== user.ownedAgency.id) {
      return {
        error: NextResponse.json({ error: "Acesso não permitido a este imóvel." }, { status: 403 }),
        property: null,
      }
    }
  }

  return { error: null, property }
}

function getExistingImages(property: { imageUrls: unknown }) {
  return Array.isArray(property.imageUrls)
    ? property.imageUrls.filter((image): image is string => typeof image === "string")
    : []
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const accessible = await resolveAccessibleProperty(id, user)
    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const formData = await request.formData().catch(() => null)
    const files = formData
      ? formData
          .getAll("images")
          .filter((entry): entry is File => entry instanceof File && entry.size > 0)
          .slice(0, MAX_FILES_PER_REQUEST)
      : []

    if (files.length === 0) {
      return NextResponse.json({ error: "Envie ao menos uma imagem válida." }, { status: 400 })
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json({ error: "Formato de imagem não suportado." }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "A imagem excede o limite de 8 MB." }, { status: 400 })
      }
    }

    const existingImages = getExistingImages(accessible.property)
    const uploadedUrls = await Promise.all(files.map((file: File) => savePropertyImage(accessible.property.id, file)))
    const nextImages = [...existingImages, ...uploadedUrls].slice(0, 6)

    const updatedProperty = await prisma.property.update({
      where: { id: accessible.property.id },
      data: {
        imageUrls: nextImages,
      },
      include: propertyInclude,
    })

    const response = NextResponse.json({ property: serializeProperty(updatedProperty) }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][images] upload failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao enviar imagens do imóvel." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  if (user.role !== UserRole.BROKER && user.role !== UserRole.AGENCY) {
    return NextResponse.json({ error: "Acesso não permitido para este perfil." }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const accessible = await resolveAccessibleProperty(id, user)
    if (accessible.error) return accessible.error
    if (!accessible.property) {
      return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 })
    }

    const imageUrl = request.nextUrl.searchParams.get("imageUrl")?.trim()

    if (!imageUrl) {
      return NextResponse.json({ error: "Informe a imagem que deseja remover." }, { status: 400 })
    }

    const existingImages = getExistingImages(accessible.property)

    if (!existingImages.includes(imageUrl)) {
      return NextResponse.json({ error: "Imagem não encontrada neste imóvel." }, { status: 404 })
    }

    const nextImages = existingImages.filter((image: string) => image !== imageUrl)

    const updatedProperty = await prisma.property.update({
      where: { id: accessible.property.id },
      data: {
        imageUrls: nextImages,
      },
      include: propertyInclude,
    })

    await deletePropertyImageFile(imageUrl)

    const response = NextResponse.json({ property: serializeProperty(updatedProperty) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][images] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao remover a imagem do imóvel." }, { status: 500 })
  }
}
