import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLeadMutations } from "@/hooks/useLeadMutations"
import { formatarNota } from "@/lib/formatters"
import { LeadStatusSelect } from "@/components/lead-detail/LeadStatusSelect"
import { LeadTagsFollowupForm } from "@/components/lead-detail/LeadTagsFollowupForm"
import { LeadObservacoesForm } from "@/components/lead-detail/LeadObservacoesForm"
import { LeadMessageGenerator } from "@/components/lead-detail/LeadMessageGenerator"
import { LeadHistoryAccordion } from "@/components/lead-detail/LeadHistoryAccordion"
import { DeleteLeadButton } from "@/components/lead-detail/DeleteLeadButton"
import type { Lead } from "@/types/lead"

interface LeadDetailModalProps {
  lead: Lead | null
  onClose: () => void
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const mutations = useLeadMutations(lead?.place_id ?? "")

  if (!lead) return null

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-[calc(100%-2rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{lead.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lead.categoria || "Sem categoria"} · {lead.endereco || "sem endereço"} · nota{" "}
            {formatarNota(lead.nota)}
          </p>
        </DialogHeader>

        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,320px)_1px_1fr]">
          <div className="space-y-5">
            <LeadStatusSelect
              status={lead.status}
              onChange={(status) => mutations.atualizarStatus.mutate(status)}
            />

            <LeadTagsFollowupForm
              lead={lead}
              onSalvar={(input) => mutations.salvarTagsFollowup.mutate(input)}
              salvando={mutations.salvarTagsFollowup.isPending}
            />

            <hr className="border-border" />

            <LeadObservacoesForm
              lead={lead}
              onSalvar={(obs) => mutations.salvarObservacoes.mutate(obs)}
              salvando={mutations.salvarObservacoes.isPending}
            />

            <hr className="border-border" />

            <LeadHistoryAccordion placeId={lead.place_id} />
          </div>

          <div className="hidden bg-border md:block" />

          <div className="flex flex-col gap-5">
            <LeadMessageGenerator
              lead={lead}
              gerarMensagem={mutations.gerarMensagem}
              marcarFollowupEnviado={mutations.marcarFollowupEnviado}
            />

            <div className="mt-auto pt-2">
              <DeleteLeadButton
                nomeLead={lead.nome}
                definitivo={lead.status === "ignorado"}
                onConfirmar={() => {
                  if (lead.status === "ignorado") {
                    mutations.excluirDefinitivamente.mutate(undefined, {
                      onSuccess: onClose,
                    })
                  } else {
                    mutations.ignorar.mutate(lead.status, { onSuccess: onClose })
                  }
                }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
