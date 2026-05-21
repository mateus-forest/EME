import { UserRole } from "@/lib/prisma-enums"

import { NextRequest,
  NextResponse } from "next/server"

import { getAuthenticatedUser, isPrismaUnavailable } from "@/lib/auth-route"
import { deletePropertyStorageFile, savePropertyAudio } from "@/lib/property-storage"
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

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
])
const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024

async function resolveAccessibleProperty(
  id: string,
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>["user"]>,
) {
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
    const audioFile = formData?.get("audio")

    if (!(audioFile instanceof File) || audioFile.size === 0) {
      return NextResponse.json({ error: "Envie um arquivo de áudio válido." }, { status: 400 })
    }

    if (!ALLOWED_AUDIO_TYPES.has(audioFile.type)) {
      return NextResponse.json({ error: "Formato de áudio não suportado." }, { status: 400 })
    }

    if (audioFile.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json({ error: "O áudio excede o limite de 20 MB." }, { status: 400 })
    }

    const previousAudioUrl = accessible.property.audioUrl
    const audioUrl = await savePropertyAudio(accessible.property.id, audioFile)

    const updatedProperty = await prisma.property.update({
      where: { id: accessible.property.id },
      data: { audioUrl },
      include: propertyInclude,
    })

    if (previousAudioUrl) {
      await deletePropertyStorageFile(previousAudioUrl)
    }

    const response = NextResponse.json({ property: serializeProperty(updatedProperty) }, { status: 201 })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][audio] upload failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: caughtError instanceof Error ? caughtError.message : "Erro interno ao enviar áudio do imóvel." },
      { status: 500 },
    )
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    if (!accessible.property.audioUrl) {
      return NextResponse.json({ error: "Nenhum áudio vinculado a este imóvel." }, { status: 404 })
    }

    const updatedProperty = await prisma.property.update({
      where: { id: accessible.property.id },
      data: { audioUrl: null },
      include: propertyInclude,
    })

    await deletePropertyStorageFile(accessible.property.audioUrl)

    const response = NextResponse.json({ property: serializeProperty(updatedProperty) })
    response.headers.set("Cache-Control", "no-store, max-age=0")
    return response
  } catch (caughtError) {
    console.error("[api][properties][audio] delete failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })

    if (isPrismaUnavailable(caughtError)) {
      return NextResponse.json(
        { error: "O serviço de imóveis está indisponível no momento. Verifique a conexão com o banco de dados." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Erro interno ao remover o áudio do imóvel." }, { status: 500 })
  }
}
