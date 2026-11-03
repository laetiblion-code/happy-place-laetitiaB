import { describe, expect, test } from "bun:test";
import { etatObjectif } from "./objectifs";

describe("état d'un objectif de taux (atteint à partir de l'objectif)", () => {
  test("atteint à partir de l'objectif", () => {
    expect(etatObjectif(72.7, 70, "plusHaut")).toBe("atteint");
    expect(etatObjectif(70, 70, "plusHaut")).toBe("atteint");
  });
  test("presque atteint à 10 % de l'objectif près", () => {
    expect(etatObjectif(63, 70, "plusHaut")).toBe("presque");
    expect(etatObjectif(66, 70, "plusHaut")).toBe("presque");
  });
  test("non atteint au-delà de 10 % d'écart", () => {
    expect(etatObjectif(62.9, 70, "plusHaut")).toBe("non");
    expect(etatObjectif(0, 70, "plusHaut")).toBe("non");
  });
  test("le pourcentage est comparé arrondi à une décimale, comme il est affiché", () => {
    expect(etatObjectif(69.96, 70, "plusHaut")).toBe("atteint");
  });
});

describe("état d'un objectif de délai (atteint sous l'objectif)", () => {
  test("atteint strictement sous l'objectif", () => {
    expect(etatObjectif(1.9, 2, "plusBas")).toBe("atteint");
    expect(etatObjectif(1.4, 2, "plusBas")).toBe("atteint");
  });
  test("à 2 j pile : pas atteint, mais presque", () => {
    expect(etatObjectif(2, 2, "plusBas")).toBe("presque");
  });
  test("presque atteint jusqu'à 10 % au-dessus", () => {
    expect(etatObjectif(2.2, 2, "plusBas")).toBe("presque");
  });
  test("non atteint au-delà de 10 % au-dessus", () => {
    expect(etatObjectif(2.3, 2, "plusBas")).toBe("non");
  });
  test("arrondi à une décimale : 1,96 s'affiche 2,0 donc n'est pas atteint", () => {
    expect(etatObjectif(1.96, 2, "plusBas")).toBe("presque");
  });
});
