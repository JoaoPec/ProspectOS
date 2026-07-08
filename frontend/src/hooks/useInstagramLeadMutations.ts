import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { instagramService } from "@/services/instagramService"
import type { StatusLead } from "@/types/lead"

export function useInstagramLeadMutations(leadId: number, postId: number) {
  const queryClient = useQueryClient()

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["instagram-leads", postId] })
    queryClient.invalidateQueries({ queryKey: ["instagram-posts"] })
    queryClient.invalidateQueries({ queryKey: ["instagram-metricas"] })
    queryClient.invalidateQueries({ queryKey: ["instagram-analytics"] })
    queryClient.invalidateQueries({ queryKey: ["instagram-nichos"] })
    queryClient.invalidateQueries({ queryKey: ["metricas-combinadas"] })
    queryClient.invalidateQueries({ queryKey: ["follow-ups-hoje"] })
  }

  const atualizarStatus = useMutation({
    mutationFn: (status: StatusLead) =>
      instagramService.atualizarStatus(leadId, status),
    onSuccess: () => {
      invalidar()
      toast.success("Status atualizado.")
    },
  })

  const salvarTagsFollowup = useMutation({
    mutationFn: (input: { tags: string; proximoFollowup: string | null }) =>
      Promise.all([
        instagramService.atualizarTags(leadId, input.tags),
        instagramService.atualizarFollowup(leadId, input.proximoFollowup),
      ]),
    onSuccess: () => {
      invalidar()
      toast.success("Tags e follow-up salvos.")
    },
  })

  const salvarObservacoes = useMutation({
    mutationFn: (observacoes: string) =>
      instagramService.atualizarObservacoes(leadId, observacoes),
    onSuccess: () => toast.success("Observações salvas."),
  })

  const gerarMensagem = useMutation({
    mutationFn: ({
      tipo,
      forcarNova,
    }: {
      tipo: "contato" | "followup"
      forcarNova?: boolean
    }) => instagramService.gerarMensagem(leadId, tipo, forcarNova),
    onSuccess: () => invalidar(),
  })

  const salvarSugestaoDm = useMutation({
    mutationFn: (sugestaoDm: string) =>
      instagramService.salvarSugestaoDm(leadId, sugestaoDm),
    onSuccess: () => invalidar(),
  })

  const marcarFollowupEnviado = useMutation({
    mutationFn: () => instagramService.marcarFollowupEnviado(leadId),
    onSuccess: (resposta) => {
      invalidar()
      toast.success(`Follow-up nº ${resposta.follow_ups_enviados} registrado.`)
    },
  })

  const ignorar = useMutation({
    mutationFn: (statusAnterior: StatusLead) =>
      instagramService.ignorar(leadId).then(() => statusAnterior),
    onSuccess: (statusAnterior) => {
      invalidar()
      toast("Lead ignorado.", {
        action: {
          label: "Desfazer",
          onClick: () => {
            instagramService.atualizarStatus(leadId, statusAnterior).then(() => {
              invalidar()
              toast.success("Lead restaurado.")
            })
          },
        },
      })
    },
  })

  const excluirDefinitivamente = useMutation({
    mutationFn: () => instagramService.excluirDefinitivamente(leadId),
    onSuccess: () => {
      invalidar()
      toast.success("Lead excluído definitivamente.")
    },
  })

  return {
    atualizarStatus,
    salvarTagsFollowup,
    salvarObservacoes,
    gerarMensagem,
    salvarSugestaoDm,
    marcarFollowupEnviado,
    ignorar,
    excluirDefinitivamente,
  }
}
