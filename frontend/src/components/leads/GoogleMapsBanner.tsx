import { BarChart3, MapPin } from "lucide-react"
import { Link } from "react-router-dom"

export function GoogleMapsBanner() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-google-maps-start/85 via-google-maps-mid/85 to-google-maps-end/85 p-5 text-white shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <MapPin className="size-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Leads do Google Maps
          </h2>
          <p className="text-sm text-white/85">
            Busque empresas sem site, acompanhe o funil e gerencie follow-ups
            com sugestões geradas por IA.
          </p>
        </div>
      </div>

      <Link
        to="/analytics"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium backdrop-blur transition-colors hover:bg-white/25"
      >
        <BarChart3 className="size-4" />
        <span className="hidden sm:inline">Analytics</span>
      </Link>
    </div>
  )
}
