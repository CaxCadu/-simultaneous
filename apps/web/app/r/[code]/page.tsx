import { normalizeRoomCode } from "@simultaneous/core";
import { notFound } from "next/navigation";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) notFound();
  return (
    <main>
      <p>Sala</p>
      <h1>{code}</h1>
      <p>Fila, player e participantes entram nas próximas etapas.</p>
    </main>
  );
}
