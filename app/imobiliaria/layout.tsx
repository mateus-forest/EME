import type { ReactNode } from "react"

import { AgencyPausedPage } from "@/components/agency-paused-page"

export default function AgencyLayout({ children }: { children: ReactNode }) {
  void children

  return <AgencyPausedPage />
}
