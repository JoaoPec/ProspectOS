import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { BuscaProgress } from "@/components/search-modal/BuscaProgress"
import { BuscaResultado } from "@/components/search-modal/BuscaResultado"
import type { useBusca } from "@/hooks/useBusca"

interface NovaBuscaModalProps {
  aberto: boolean
  onFechar: () => void
  onMinimizar: () => void
  busca: ReturnType<typeof useBusca>
}

export function NovaBuscaModal({
  aberto,
  onFechar,
  onMinimizar,
  busca,
}: NovaBuscaModalProps) {
  const [queries, setQueries] = useState("")
  const { dispararBusca, statusBusca, pollingAtivo, resultadoFinal, limparResultado } =
    busca

  const rodando = pollingAtivo && statusBusca.data?.rodando

  const handleConfirmar = () => {
    if (!queries.trim()) return
    dispararBusca.mutate(queries)
  }

  const handleFechar = () => {
    limparResultado()
    onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !rodando && handleFechar()}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => rodando && e.preventDefault()}
        onEscapeKeyDown={(e) => rodando && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nova busca de leads</DialogTitle>
          <DialogDescription>
            Um nicho + cidade por linha, ex.: "clínica de estética em Londrina"
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={8}
          value={queries}
          onChange={(e) => setQueries(e.target.value)}
          disabled={Boolean(rodando)}
          placeholder={"clínica de estética em Londrina\ncorretor de imóveis em Londrina"}
        />

        {statusBusca.data && pollingAtivo && (
          <BuscaProgress estado={statusBusca.data} />
        )}

        {resultadoFinal && <BuscaResultado estado={resultadoFinal} />}

        <div className="flex justify-end gap-2">
          {!rodando && (
            <Button variant="ghost" onClick={handleFechar}>
              {resultadoFinal ? "Fechar" : "Cancelar"}
            </Button>
          )}
          {rodando && (
            <Button variant="ghost" onClick={onMinimizar}>
              Minimizar e continuar usando
            </Button>
          )}
          <Button
            onClick={handleConfirmar}
            disabled={Boolean(rodando) || dispararBusca.isPending}
          >
            {rodando || dispararBusca.isPending ? "Buscando..." : "Buscar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
