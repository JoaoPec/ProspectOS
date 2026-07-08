import { Archive, Star } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatarNota, followupVencidoOuHoje } from "@/lib/formatters"
import { useLeadMutations } from "@/hooks/useLeadMutations"
import { StatusBadge } from "@/components/leads/StatusBadge"
import { TagChips } from "@/components/leads/TagChips"
import { FollowupBadge } from "@/components/leads/FollowupBadge"
import { LeadDificilBadge } from "@/components/leads/LeadDificilBadge"
import type { Lead } from "@/types/lead"

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  selecionado: boolean
  onAlternarSelecao: () => void
}

export function LeadCard({
  lead,
  onClick,
  selecionado,
  onAlternarSelecao,
}: LeadCardProps) {
  const vencido = followupVencidoOuHoje(lead.proximo_followup)
  const { ignorar } = useLeadMutations(lead.place_id)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick()
      }}
      aria-label={`Abrir detalhes de ${lead.nome}`}
      className={cn(
        "relative flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40",
        vencido && "ring-2 ring-warning",
        selecionado && "ring-2 ring-primary"
      )}
    >
      <input
        type="checkbox"
        checked={selecionado}
        onChange={() => onAlternarSelecao()}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Selecionar ${lead.nome}`}
        className="absolute right-3 top-3 size-4 cursor-pointer accent-primary"
      />

      <div className="flex items-start justify-between gap-2 pr-6">
        <h3 className="font-medium leading-snug">{lead.nome}</h3>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={lead.status} />
          {vencido && <FollowupBadge />}
          {lead.lead_dificil && <LeadDificilBadge />}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {lead.categoria || "Sem categoria"}
      </p>
      <p className="text-xs text-muted-foreground">
        {lead.endereco || "Sem endereço"}
      </p>

      <TagChips tags={lead.tags} />

      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Star className="size-3.5 fill-warning text-warning" />
        <span className="font-medium text-foreground">
          {formatarNota(lead.nota)}
        </span>
        <span>({lead.num_avaliacoes ?? 0} avaliações)</span>
      </div>

      {lead.lead_dificil && (
        <Button
          size="sm"
          variant="outline"
          className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation()
            ignorar.mutate(lead.status)
          }}
        >
          <Archive className="size-3.5" />
          Arquivar lead difícil
        </Button>
      )}
    </motion.div>
  )
}
