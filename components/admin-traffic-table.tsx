"use client"

import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { OverviewEmpty } from "@/components/admin-journey-overview-ui"

export type TrafficColumn<T> = { key: string; label: string; value: (row: T) => string | number; render?: (row: T) => ReactNode; numeric?: boolean }

export function TrafficTable<T extends { label: string }>({ rows, columns, label, initialSort, unavailable = false }: { rows: T[]; columns: TrafficColumn<T>[]; label: string; initialSort: string; unavailable?: boolean }) {
  const [sort, setSort] = useState({ key: initialSort, descending: true })
  const [page, setPage] = useState(0)
  if (!rows.length) return <OverviewEmpty unavailable={unavailable} />
  const column = columns.find(item => item.key === sort.key) ?? columns[0]
  const ordered = [...rows].sort((a, b) => {
    const av = column.value(a), bv = column.value(b)
    const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR")
    return (sort.descending ? -comparison : comparison) || a.label.localeCompare(b.label, "pt-BR")
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1))
  return <div>
    <div className="max-w-full overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label={`${label}: tabela rolável`}>
      <table aria-label={label} className="w-full border-collapse text-left">
        <thead><tr className="border-b border-[#e8eee9]">{columns.map(item => <th key={item.key} scope="col" aria-sort={sort.key === item.key ? sort.descending ? "descending" : "ascending" : "none"} className={`px-2 py-2 ${item.numeric ? "text-right" : "text-left"}`}>
          <button type="button" onClick={() => { setSort({ key: item.key, descending: sort.key === item.key ? !sort.descending : Boolean(item.numeric) }); setPage(0) }} className={`inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-medium text-[#718278] ${item.numeric ? "justify-end" : ""}`} aria-label={`Ordenar ${label} por ${item.label}`}>
            {item.label}{sort.key !== item.key ? <ArrowUpDown className="size-2.5 opacity-40" /> : sort.descending ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" />}
          </button>
        </th>)}</tr></thead>
        <tbody>{ordered.slice(currentPage * 10, currentPage * 10 + 10).map(row => <tr key={row.label} className="border-b border-[#f0f3f0] last:border-0 hover:bg-[#f8faf8]">{columns.map(item => <td key={item.key} className={`px-2 py-3 text-xs tabular-nums text-[#4d6255] ${item.numeric ? "whitespace-nowrap text-right" : "min-w-28 max-w-64 break-words"}`}>{item.render ? item.render(row) : typeof item.value(row) === "number" ? item.value(row).toLocaleString("pt-BR") : item.value(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {rows.length > 10 && <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[#79897e]"><span>{currentPage * 10 + 1}–{Math.min(currentPage * 10 + 10, rows.length)} de {rows.length}</span><div className="flex gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-md border px-2 py-1 disabled:opacity-30" aria-label={`Página anterior de ${label}`}>Anterior</button><button type="button" disabled={(currentPage + 1) * 10 >= rows.length} onClick={() => setPage(currentPage + 1)} className="rounded-md border px-2 py-1 disabled:opacity-30" aria-label={`Próxima página de ${label}`}>Próxima</button></div></div>}
  </div>
}
