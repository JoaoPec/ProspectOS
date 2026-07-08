import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import { LayoutGrid, List, Loader2 } from "lucide-react"
import { useLeads } from "@/hooks/useLeads"
import { useSelecaoLeads } from "@/hooks/useSelecaoLeads"
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver"
import { LeadCard } from "@/components/leads/LeadCard"
import { EmptyState } from "@/components/leads/EmptyState"
import { BulkActionsBar } from "@/components/leads/BulkActionsBar"
import { KanbanBoard } from "@/components/leads/KanbanBoard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FiltrosLeads, Lead } from "@/types/lead"

interface LeadGridProps {
  filtros: FiltrosLeads
  filtrosEmUso: boolean
  onLimparFiltros: () => void
  onSelecionarLead: (lead: Lead) => void
  onNovaBusca?: () => void
}

export function LeadGrid({
  filtros,
  filtrosEmUso,
  onLimparFiltros,
  onSelecionarLead,
  onNovaBusca,
}: LeadGridProps) {
  const [visualizacao, setVisualizacao] = useState<"lista" | "kanban">("lista")

  const filtrosEfetivos: FiltrosLeads =
    visualizacao === "kanban" ? { ...filtros, status: "" } : filtros

  const { leads, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useLeads(filtrosEfetivos)
  const { selecionados, alternar, limpar, quantidade } = useSelecaoLeads()

  const sentinelaRef = useIntersectionObserver(
    () => fetchNextPage(),
    Boolean(hasNextPage) && !isFetchingNextPage
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px]" />
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        filtrosEmUso={filtrosEmUso}
        onLimparFiltros={onLimparFiltros}
        onNovaBusca={onNovaBusca}
      />
    )
  }

  const leadsForaDoFunil = leads.filter((l) =>
    ["recusou", "ignorado"].includes(l.status)
  ).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {leads.length} lead(s) carregado(s)
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2", visualizacao === "lista" && "bg-accent")}
            onClick={() => setVisualizacao("lista")}
          >
            <List className="size-3.5" />
            Lista
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2", visualizacao === "kanban" && "bg-accent")}
            onClick={() => setVisualizacao("kanban")}
          >
            <LayoutGrid className="size-3.5" />
            Kanban
          </Button>
        </div>
      </div>

      {visualizacao === "kanban" ? (
        <>
          <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen px-4 sm:px-6">
            <KanbanBoard leads={leads} onSelecionarLead={onSelecionarLead} />
          </div>
          {leadsForaDoFunil > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {leadsForaDoFunil} lead(s) recusado(s)/ignorado(s) não aparecem
              no Kanban — use a visualização em Lista para vê-los.
            </p>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard
              key={lead.place_id}
              lead={lead}
              onClick={() => onSelecionarLead(lead)}
              selecionado={selecionados.has(lead.place_id)}
              onAlternarSelecao={() => alternar(lead.place_id)}
            />
          ))}
        </div>
      )}

      {visualizacao === "lista" && hasNextPage && (
        <div ref={sentinelaRef} className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <AnimatePresence>
        {quantidade > 0 && (
          <BulkActionsBar
            placeIdsSelecionados={Array.from(selecionados)}
            onLimparSelecao={limpar}
            modoIgnorados={filtros.status === "ignorado"}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
