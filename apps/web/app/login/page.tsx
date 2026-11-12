import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main>
      <h1>Entrar</h1>
      <p>Use seu e-mail e senha para criar ou entrar em uma sala.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
