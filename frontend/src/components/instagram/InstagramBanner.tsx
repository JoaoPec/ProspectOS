import { Archive, BarChart3 } from "lucide-react"
import { Link } from "react-router-dom"
import { InstagramIcon } from "@/components/icons/InstagramIcon"

export function InstagramBanner() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-instagram-start/85 via-instagram-mid/85 to-instagram-end/85 p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <InstagramIcon className="size-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Leads do Instagram
          </h2>
          <p className="text-sm text-white/85">
            Cole o link de um post para extrair os comentários, enriquecer os
            perfis e classificar os leads automaticamente por IA.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/instagram/arquivados"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25"
        >
          <Archive className="size-4" />
          <span className="hidden sm:inline">Arquivados</span>
        </Link>
        <Link
          to="/instagram/analytics"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25"
        >
          <BarChart3 className="size-4" />
          <span className="hidden sm:inline">Analytics</span>
        </Link>
      </div>
    </div>
  )
}
