import { useState } from "react"

export function useSelecaoLeadsInstagram() {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())

  const alternar = (leadId: number) => {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(leadId)) {
        novo.delete(leadId)
      } else {
        novo.add(leadId)
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
