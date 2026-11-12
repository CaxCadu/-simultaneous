const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0, 1

/** Gera um código de sala de 6 caracteres. */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${ALPHABET}]{6}$`).test(code) ? code : null;
}
