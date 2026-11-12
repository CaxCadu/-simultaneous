import { normalizeRoomCode } from "@simultaneous/core";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Room } from "./room";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) notFound();
  return (
    <main>
      <Suspense>
        <Room code={code} />
      </Suspense>
    </main>
  );
}
