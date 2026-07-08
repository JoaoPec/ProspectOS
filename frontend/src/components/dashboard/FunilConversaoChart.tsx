import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { LABEL_STATUS } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import type { EstagioFunil } from "@/types/analytics"

const CORES_ESTAGIO = [
  "var(--info)",
  "var(--warning)",
  "var(--status-purple)",
  "var(--success)",
]

interface FunilConversaoChartProps {
  estagios: EstagioFunil[] | undefined
  isLoading: boolean
}

export function FunilConversaoChart({
  estagios,
  isLoading,
}: FunilConversaoChartProps) {
  if (isLoading || !estagios) {
    return <Skeleton className="h-[280px]" />
  }

  const dados = estagios.map((e) => ({
    estagio: LABEL_STATUS[e.status],
    total: e.total,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Funil de conversão
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} layout="vertical" margin={{ left: 12 }}>
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="estagio" width={90} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {dados.map((_, i) => (
              <Cell key={i} fill={CORES_ESTAGIO[i % CORES_ESTAGIO.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
