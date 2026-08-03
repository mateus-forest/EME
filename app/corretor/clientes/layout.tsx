import type { ReactNode } from "react"

import { BrokerClientsPage } from "@/components/broker-clients-page"

export default function BrokerClientsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BrokerClientsPage />
      {children}
    </>
  )
}
