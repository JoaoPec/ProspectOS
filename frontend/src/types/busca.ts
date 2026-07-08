export type EtapaBusca = "scraping" | "verificando_sites" | ""

export interface EstadoBusca {
  rodando: boolean
  mensagem: string
  etapa: EtapaBusca
  empresas_encontradas: number
  empresas_processadas: number
}
