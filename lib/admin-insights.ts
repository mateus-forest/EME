import "server-only"

import { getAdminMasterInsights } from "@/lib/admin-master-insights"

export async function getAdminInsights() {
  return getAdminMasterInsights()
}
