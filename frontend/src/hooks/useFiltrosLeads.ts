import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { FILTROS_VAZIOS, type FiltrosLeads, type StatusLead } from "@/types/lead"

function paramsParaFiltros(params: URLSearchParams): FiltrosLeads {
  return {
    busca: params.get("busca") ?? "",
    status: (params.get("status") as StatusLead | "") ?? "",
    nicho: params.get("nicho") ?? "",
    nota_min: (params.get("nota_min") as FiltrosLeads["nota_min"]) ?? "",
  }
}

export function useFiltrosLeads() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filtros = useMemo(() => paramsParaFiltros(searchParams), [searchParams])

  const setFiltros = useCallback(
    (
      atualizacao: FiltrosLeads | ((atual: FiltrosLeads) => FiltrosLeads)
    ) => {
      setSearchParams(
        (params) => {
          const atual = paramsParaFiltros(params)
          const novo =
            typeof atualizacao === "function" ? atualizacao(atual) : atualizacao

          const novosParams = new URLSearchParams()
          if (novo.busca) novosParams.set("busca", novo.busca)
          if (novo.status) novosParams.set("status", novo.status)
          if (novo.nicho) novosParams.set("nicho", novo.nicho)
          if (novo.nota_min) novosParams.set("nota_min", novo.nota_min)
          return novosParams
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const limpar = useCallback(() => setFiltros(FILTROS_VAZIOS), [setFiltros])

  const filtrosEmUso = Boolean(
    filtros.busca || filtros.status || filtros.nicho || filtros.nota_min
  )

  return { filtros, setFiltros, limpar, filtrosEmUso }
}
