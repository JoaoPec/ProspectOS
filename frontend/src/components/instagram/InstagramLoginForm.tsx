import { useState } from "react"
import { KeyRound, Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { instagramService } from "@/services/instagramService"

export function InstagramLoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [logando, setLogando] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return
    setLogando(true)
    try {
      await instagramService.login(username.trim(), password)
      toast.success("Login feito com sucesso!")
      setUsername("")
      setPassword("")
    } catch (e: any) {
      toast.error(e?.message || "Erro ao fazer login")
    } finally {
      setLogando(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <LogIn className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Login no Instagram (conta secundária)
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuário do Instagram"
          disabled={logando}
          className="sm:flex-[1]"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="Senha"
          disabled={logando}
          className="sm:flex-[1]"
        />
        <Button
          onClick={handleLogin}
          disabled={logando || !username.trim() || !password.trim()}
        >
          {logando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          <span className="hidden sm:inline ml-1">Entrar</span>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Use uma conta secundária. A sessão fica salva no servidor.
      </p>
    </div>
  )
}
