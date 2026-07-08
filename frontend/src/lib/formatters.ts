export function formatarNota(nota: number | null): string {
  return nota === null || nota === undefined ? "-" : nota.toFixed(1)
}

export function formatarData(data: string | null): string {
  if (!data) return "-"
  const [ano, mes, dia] = data.split("-")
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

export function formatarDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR")
  } catch {
    return iso
  }
}

export function hojeISO(): string {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, "0")
  const dia = String(agora.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

export function followupVencidoOuHoje(proximoFollowup: string | null): boolean {
  if (!proximoFollowup) return false
  return proximoFollowup <= hojeISO()
}

export function tagsParaLista(tags: string | null): string[] {
  if (!tags) return []
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}
