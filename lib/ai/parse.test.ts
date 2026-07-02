import { describe, expect, it } from "vitest";
import { AiParseError, parseJsonObject, parseReplyOutput } from "./parse";

describe("parseJsonObject", () => {
  it("parse un objet JSON nu", () => {
    expect(parseJsonObject('{"reply": "Merci!"}')).toEqual({
      reply: "Merci!",
    });
  });

  it("strip les fences markdown ```json", () => {
    expect(
      parseJsonObject('```json\n{"reply": "Merci!"}\n```'),
    ).toEqual({ reply: "Merci!" });
  });

  it("strip les fences sans langue", () => {
    expect(parseJsonObject('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("tolère du texte parasite autour de l'objet", () => {
    expect(
      parseJsonObject('Voici la réponse :\n{"reply": "Merci!"}\nVoilà.'),
    ).toEqual({ reply: "Merci!" });
  });

  it("rejette une sortie sans objet JSON", () => {
    expect(() => parseJsonObject("Merci beaucoup!")).toThrow(AiParseError);
  });

  it("rejette un JSON invalide", () => {
    expect(() => parseJsonObject('{"reply": }')).toThrow(AiParseError);
  });
});

describe("parseReplyOutput", () => {
  it("retourne le champ reply trimé", () => {
    expect(parseReplyOutput('{"reply": "  Merci Julie!  "}')).toBe(
      "Merci Julie!",
    );
  });

  it("rejette un reply manquant ou vide", () => {
    expect(() => parseReplyOutput('{"other": "x"}')).toThrow(AiParseError);
    expect(() => parseReplyOutput('{"reply": "   "}')).toThrow(AiParseError);
    expect(() => parseReplyOutput('{"reply": 42}')).toThrow(AiParseError);
  });
});
