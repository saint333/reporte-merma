import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";

import { ApiError, iniciarSesion } from "../lib/api";
import { leerSesion } from "../lib/sesion";

const TITULO = import.meta.env.VITE_APP_TITLE ?? "Control de Mermas";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (leerSesion()) {
    const destino = (location.state as { desde?: string } | null)?.desde ?? "/";
    return <Navigate to={destino} replace />;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await iniciarSesion(usuario.trim(), password);
      const destino = (location.state as { desde?: string } | null)?.desde ?? "/";
      navigate(destino, { replace: true });
    } catch (fallo) {
      if (fallo instanceof ApiError && fallo.status === 401) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        setError("No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="border-border bg-surface w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <p className="text-muted text-[10px] font-semibold tracking-[0.16em] uppercase">
          Reporte gerencial
        </p>
        <h1 className="text-ink mt-1 text-lg font-semibold tracking-tight">{TITULO}</h1>

        <form className="mt-5 space-y-4" onSubmit={enviar} noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-usuario" className="text-ink text-xs font-semibold">
              Usuario
            </label>
            <InputText
              id="login-usuario"
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              autoComplete="username"
              required
              disabled={enviando}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-ink text-xs font-semibold">
              Contraseña
            </label>
            <Password
              inputId="login-password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              feedback={false}
              toggleMask
              autoComplete="current-password"
              required
              disabled={enviando}
              className="w-full"
              inputClassName="w-full"
            />
          </div>

          {error && <Message severity="error" text={error} className="w-full" />}

          <Button
            type="submit"
            label={enviando ? "Ingresando…" : "Ingresar"}
            disabled={enviando || !usuario.trim() || !password}
            className="w-full"
          />
        </form>
      </main>
    </div>
  );
}
