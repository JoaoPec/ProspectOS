import { AnimatePresence } from "framer-motion"
import { useState } from "react"
import { Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeadsInstagram } from "@/hooks/useLeadsInstagram"
import { useSelecaoLeadsInstagram } from "@/hooks/useSelecaoLeadsInstagram"
import { InstagramLeadCard } from "@/components/instagram/InstagramLeadCard"
import { InstagramBulkActionsBar } from "@/components/instagram/InstagramBulkActionsBar"
import { InstagramLeadDetailModal } from "@/components/instagram/InstagramLeadDetailModal"
import type { StatusLead } from "@/types/lead"

interface LeadsDoPostProps {
  postId: number
  filtroStatus: StatusLead | ""
  filtroNicho: string
  busca: string
}

export function LeadsDoPost({
  postId,
  filtroStatus,
  filtroNicho,
  busca,
}: LeadsDoPostProps) {
  const { leads, isLoading } = useLeadsInstagram(postId, {
    status: filtroStatus,
    nicho: filtroNicho,
    busca,
  })
  const { selecionados, alternar, limpar, quantidade } =
    useSelecaoLeadsInstagram()
  const [leadIdSelecionado, setLeadIdSelecionado] = useState<number | null>(
    null
  )
  const leadDetalhe = leads.find((l) => l.id === leadIdSelecionado) ?? null

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px]" />
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
        <Users className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum perfil corresponde aos filtros selecionados.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {leads.map((lead) => (
          <InstagramLeadCard
            key={lead.id}
            lead={lead}
            selecionado={selecionados.has(lead.id)}
            onAlternarSelecao={() => alternar(lead.id)}
            onAbrirDetalhe={() => setLeadIdSelecionado(lead.id)}
          />
        ))}
      </div>

      <InstagramLeadDetailModal
        lead={leadDetalhe}
        onClose={() => setLeadIdSelecionado(null)}
      />

      <AnimatePresence>
        {quantidade > 0 && (
          <InstagramBulkActionsBar
            postId={postId}
            leadIdsSelecionados={Array.from(selecionados)}
            onLimparSelecao={limpar}
            modoIgnorados={filtroStatus === "ignorado"}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
