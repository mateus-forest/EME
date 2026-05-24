import { ArrowUpRight, Eye, MessageCircleMore, Users } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

const icons = [ArrowUpRight, Eye, MessageCircleMore, Users]

type BrokerStatsProps = {
  stats: Array<{
    title: string
    value: string
    change: string
  }>
}

export function BrokerStats({ stats }: BrokerStatsProps) {
  return (
    <section className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = icons[index]

        return (
          <Card
            key={stat.title}
            className="h-full overflow-hidden rounded-[1.5rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
          >
            <CardContent className="flex h-full min-w-0 items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/55">{stat.title}</p>
                  <p className="mt-2.5 min-w-0 break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#69F0AE] sm:text-sm">{stat.change}</p>
              </div>

              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <Icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
