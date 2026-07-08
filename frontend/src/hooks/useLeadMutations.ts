import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { leadsService } from "@/services/leadsService"
import { useInvalidarLeads } from "@/hooks/useInvalidarLeads"
import type { StatusLead } from "@/types/lead"

export function useLeadMutations(placeId: string) {
  const queryClient = useQueryClient()
  const invalidarListaEMetricas = useInvalidarLeads()

  const atualizarStatus = useMutation({
    mutationFn: (status: StatusLead) =>
      leadsService.atualizarStatus(placeId, status),
    onSuccess: () => {
      invalidarListaEMetricas()
      toast.success("Status atualizado.")
    },
  })

  const salvarTagsFollowup = useMutation({
    mutationFn: (input: { tags: string; proximoFollowup: string | null }) =>
      Promise.all([
        leadsService.atualizarTags(placeId, input.tags),
        leadsService.atualizarFollowup(placeId, input.proximoFollowup),
      ]),
    onSuccess: () => {
      invalidarListaEMetricas()
      toast.success("Tags e follow-up salvos.")
    },
  })

  const salvarObservacoes = useMutation({
    mutationFn: (observacoes: string) =>
      leadsService.atualizarObservacoes(placeId, observacoes),
    onSuccess: () => toast.success("Observações salvas."),
  })

  const gerarMensagem = useMutation({
    mutationFn: ({
      forcarNova,
      tipo,
    }: {
      forcarNova: boolean
      tipo?: "contato" | "followup"
    }) => leadsService.gerarMensagem(placeId, forcarNova, tipo),
  })

  const marcarFollowupEnviado = useMutation({
    mutationFn: () => leadsService.marcarFollowupEnviado(placeId),
    onSuccess: (resposta) => {
      invalidarListaEMetricas()
      toast.success(`Follow-up nº ${resposta.follow_ups_enviados} registrado.`)
    },
  })

  const ignorar = useMutation({
    mutationFn: (statusAnterior: StatusLead) => leadsService.ignorar(placeId).then(() => statusAnterior),
    onSuccess: (statusAnterior) => {
      invalidarListaEMetricas()
      toast("Lead ignorado.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            leadsService.atualizarStatus(placeId, statusAnterior).then(() => {
              queryClient.invalidateQueries({ queryKey: ["leads"] })
              queryClient.invalidateQueries({ queryKey: ["metricas"] })
              toast.success("Lead restaurado.")
            })
          },
        },
      })
    },
  })

  const excluirDefinitivamente = useMutation({
    mutationFn: () => leadsService.excluirDefinitivamente(placeId),
    onSuccess: () => {
      invalidarListaEMetricas()
      toast.success("Lead excluído definitivamente.")
    },
  })

  return {
    atualizarStatus,
    salvarTagsFollowup,
    salvarObservacoes,
    gerarMensagem,
    marcarFollowupEnviado,
    ignorar,
    excluirDefinitivamente,
  }
}
