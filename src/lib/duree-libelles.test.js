import { describe, expect, test } from "bun:test";
const { ilYAShort, joursEntre, libelleResolution, texteAttenteAncienne } =
  await import("./duree-libelles");

const formatFr = (n) => String(n);

describe("texteAttenteAncienne", () => {
  test("le libellé abrégé n'écrit le nombre de jours qu'une fois (bug « plus de 3 3 j »)", () => {
    const { court, long } = texteAttenteAncienne(1, formatFr, 3);
    expect(court).toBe("1 en attente depuis plus de 3 j");
    expect(court).not.toMatch(/3\s+3/);
    expect(long).toBe("1 en attente depuis plus de 3 jours");
  });

  test("le compteur est formaté par le formateur fourni, une seule fois", () => {
    const { court } = texteAttenteAncienne(12, (n) => `${n} 000`, 3);
    expect(court.match(/000/g)).toHaveLength(1);
  });
});

describe("libelleResolution", () => {
  test("accord au pluriel et cas du jour unique", () => {
    expect(libelleResolution(12)).toBe("en 12 jours");
    expect(libelleResolution(1)).toBe("en 1 jour");
    expect(libelleResolution(0)).toBe("en moins d'un jour");
  });
});

describe("joursEntre", () => {
  test("calcule des jours entiers, sans valeur négative", () => {
    expect(joursEntre("2026-10-01T00:00:00Z", "2026-10-13T00:00:00Z")).toBe(12);
    expect(joursEntre("2026-10-13T00:00:00Z", "2026-10-01T00:00:00Z")).toBe(0);
  });
});

describe("ilYAShort", () => {
  const maintenant = Date.parse("2026-11-02T12:00:00Z");
  test("abrège l'unité et garde le préfixe", () => {
    expect(ilYAShort("2026-10-31T12:00:00Z", maintenant)).toBe("il y a 2 j");
    expect(ilYAShort("2026-11-02T07:00:00Z", maintenant)).toBe("il y a 5 h");
    expect(ilYAShort("2026-11-02T11:20:00Z", maintenant)).toBe("il y a 40 min");
    expect(ilYAShort("2026-11-02T11:59:50Z", maintenant)).toBe("à l'instant");
  });
});
