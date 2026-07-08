import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { configService } from "@/services/configService"
import type { ProvedorIA } from "@/types/config"

export function useConfiguracoes() {
  return useQuery({
    queryKey: ["configuracoes"],
    queryFn: configService.listar,
  })
}

export function useSalvarConfiguracao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ chave, valor }: { chave: ProvedorIA; valor: string }) =>
      configService.salvar(chave, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes"] })
      toast.success("Chave de API salva.")
    },
  })
}
