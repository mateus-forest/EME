import { agendaEntityModule } from "@/lib/cos/entities/agenda"
import { catalogEntityModule } from "@/lib/cos/entities/catalog"
import { contractEntityModule } from "@/lib/cos/entities/contract"
import { financeEntityModule } from "@/lib/cos/entities/finance"
import { generalEntityModule } from "@/lib/cos/entities/general"
import { leadEntityModule } from "@/lib/cos/entities/lead"
import { operationEntityModule } from "@/lib/cos/entities/operation"
import { propertyEntityModule } from "@/lib/cos/entities/property"
import { proposalEntityModule } from "@/lib/cos/entities/proposal"
import { studioIaEntityModule } from "@/lib/cos/entities/studio-ia"

export const cosEntityModules = [
  generalEntityModule,
  leadEntityModule,
  propertyEntityModule,
  proposalEntityModule,
  contractEntityModule,
  agendaEntityModule,
  financeEntityModule,
  catalogEntityModule,
  studioIaEntityModule,
  operationEntityModule,
]

export {
  agendaEntityModule,
  catalogEntityModule,
  contractEntityModule,
  financeEntityModule,
  generalEntityModule,
  leadEntityModule,
  operationEntityModule,
  propertyEntityModule,
  proposalEntityModule,
  studioIaEntityModule,
}
