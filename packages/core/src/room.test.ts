import { describe, expect, it } from "vitest";
import { generateRoomCode, normalizeRoomCode } from "./room";

describe("room code", () => {
  it("gera 6 caracteres válidos", () => {
    expect(normalizeRoomCode(generateRoomCode())).not.toBeNull();
  });
  it("normaliza minúsculas e hífen", () => {
    expect(normalizeRoomCode("abc-234")).toBe("ABC234");
  });
  it("rejeita caracteres ambíguos e tamanho errado", () => {
    expect(normalizeRoomCode("ABC10I")).toBeNull();
    expect(normalizeRoomCode("ABC")).toBeNull();
  });
});
