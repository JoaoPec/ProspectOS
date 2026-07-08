import { httpClient } from "@/services/httpClient"
import type { EstadoBusca } from "@/types/busca"

export const buscaService = {
  disparar: (queries: string) =>
    httpClient.post<{ ok: true }>("/api/buscar", { queries }),

  consultarStatus: () => httpClient.get<EstadoBusca>("/api/buscar/status"),
}
