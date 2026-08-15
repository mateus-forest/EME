export type StudioVideoGenerationLockLifecycle = {
  generationLockId: string | null
  jobPersisted: boolean
  lockLinked: boolean
}

export function shouldReleaseStudioVideoGenerationLock(
  lifecycle: StudioVideoGenerationLockLifecycle,
) {
  return Boolean(
    lifecycle.generationLockId &&
      (!lifecycle.jobPersisted || !lifecycle.lockLinked),
  )
}
