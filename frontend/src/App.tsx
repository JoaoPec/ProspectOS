import { BrowserRouter, Route, Routes } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/queryClient"
import { DashboardPage } from "@/pages/DashboardPage"
import { LeadsMapsPage } from "@/pages/LeadsMapsPage"
import { AnalyticsPage } from "@/pages/AnalyticsPage"
import { InstagramPage } from "@/pages/InstagramPage"
import { InstagramAnalyticsPage } from "@/pages/InstagramAnalyticsPage"
import { InstagramArquivadosPage } from "@/pages/InstagramArquivadosPage"
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage"
import { DocumentacaoPage } from "@/pages/DocumentacaoPage"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsMapsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/instagram" element={<InstagramPage />} />
            <Route path="/instagram/analytics" element={<InstagramAnalyticsPage />} />
            <Route path="/instagram/arquivados" element={<InstagramArquivadosPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/documentacao" element={<DocumentacaoPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
