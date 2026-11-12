import { JoinForm } from "./join-form";

export default function Home() {
  return (
    <main>
      <h1>Simultaneous</h1>
      <p>
        Uma jam entre Spotify e Deezer. Crie uma sala, compartilhe o código e todo
        mundo ouve a mesma música no próprio app.
      </p>
      <JoinForm />
      <p style={{ marginTop: 32, fontSize: 14 }}>
        Instale como app: no Android use “Instalar app” no Chrome; no iPhone use
        Compartilhar → “Adicionar à Tela de Início”.
      </p>
    </main>
  );
}
