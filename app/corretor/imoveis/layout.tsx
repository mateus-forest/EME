import type { ReactNode } from "react"

import { BrokerMyPropertiesPage } from "@/components/broker-my-properties-page"

export default function BrokerPropertiesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BrokerMyPropertiesPage />
      {children}
    </>
  )
}
