import { cn } from "@/lib/utils"

interface StatTileProps {
  rotulo: string
  valor: string | number
  variante?: "default" | "destaque" | "alerta"
}

export function StatTile({ rotulo, valor, variante = "default" }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          variante === "destaque" && "text-success",
          variante === "alerta" && "text-warning"
        )}
      >
        {valor}
      </p>
    </div>
  )
}
