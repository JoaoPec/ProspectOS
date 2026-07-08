import { httpClient } from "@/services/httpClient"
import type { Configuracoes, ProvedorIA } from "@/types/config"

export const configService = {
  listar: () => httpClient.get<Configuracoes>("/api/configuracoes"),

  salvar: (chave: ProvedorIA, valor: string) =>
    httpClient.post<{ ok: true; mascarada: string }>("/api/configuracoes", {
      chave,
      valor,
    }),
}
