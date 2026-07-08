import { useQuery } from "@tanstack/react-query"
import { combinadoService } from "@/services/combinadoService"

export function useMetricasCombinadas() {
  return useQuery({
    queryKey: ["metricas-combinadas"],
    queryFn: combinadoService.metricas,
  })
}

export function useFollowUpsHoje() {
  const query = useQuery({
    queryKey: ["follow-ups-hoje"],
    queryFn: combinadoService.followUpsHoje,
  })

  return { leads: query.data?.leads ?? [], ...query }
}

export function useFunilCombinado() {
  return useQuery({
    queryKey: ["analytics", "funil-combinado"],
    queryFn: combinadoService.funilCombinado,
  })
}

export function usePorNichoCombinado() {
  return useQuery({
    queryKey: ["analytics", "por-nicho-combinado"],
    queryFn: combinadoService.porNichoCombinado,
  })
}
