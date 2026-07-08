import { useState } from "react"

export function useSelecaoLeads() {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const alternar = (placeId: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(placeId)) {
        novo.delete(placeId)
      } else {
        novo.add(placeId)
      }
      return novo
    })
  }

  const limpar = () => setSelecionados(new Set())

  return {
    selecionados,
    alternar,
    limpar,
    quantidade: selecionados.size,
  }
}
