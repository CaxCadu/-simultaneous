# Simultaneous

Jam entre **Spotify** e **Deezer**. Uma pessoa cria uma sala, compartilha o código/link, e cada participante ouve a mesma faixa, no mesmo ponto, **no próprio app** — mesmo em plataformas diferentes.

O Simultaneous não transmite áudio: ele coordena os players oficiais. Cada faixa é identificada pelo **ISRC**, o que permite achar a versão equivalente em cada plataforma, e um relógio de sala compartilhado mantém todo mundo alinhado.

> Status: em construção (scaffold + motor de sync). Veja o plano de etapas abaixo.

## Como funciona

- **Web app instalável (PWA)**, sem APK. Android: "Instalar app" no Chrome. iPhone: Compartilhar → "Adicionar à Tela de Início".
- **Spotify**: controle automático do app do Spotify via Web API (Spotify Connect). Requer Premium.
- **Deezer**: o Deezer não oferece mais SDK/API de player para novos apps, e uma página web não consegue controlar o app dele. O lado Deezer é **semiautomático**: o Simultaneous abre a faixa certa no app do Deezer e mostra uma contagem regressiva sincronizada para você apertar play.
- **Backend**: Supabase (Realtime + Postgres). **Deploy**: Vercel.

### Limites do Spotify
Desde fev/2026, apps em Development Mode exigem que o dono do app tenha Premium e aceitam no máximo 5 usuários autorizados. Este projeto é open source: **traga seu próprio Client ID** ao hospedar a sua instância.

## Estrutura

```
apps/web         Next.js (App Router) — PWA
packages/core    tipos, algoritmo de sync, códigos de sala (testado)
```

## Desenvolvimento

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test
pnpm typecheck
```

## Roadmap

1. Scaffold + motor de sync ✅
2. Supabase (salas, realtime, login anônimo)
3. Criar/entrar em salas com presence
4. Catálogo + matching por ISRC
5. Spotify OAuth + player
6. Adapter Deezer (após spike)
7. UI da sala (fila, busca, controles)
8. PWA completo

## Licença

MIT
