import { describe, expect, mock, test } from "bun:test";

mock.module("@/integrations/supabase/client", () => ({ supabase: {} }));
const {
  deltaText,
  evaluerTendance,
  formatMetricValue,
  formatObjectif,
  libelleTendance,
  decomposerDuree,
  ordreAccueil,
  progressionObjectif,
} = await import("./dashboard");

describe("metric numeric formatting", () => {
  test("numeric text percentage delta is expressed in points", () => {
    expect(deltaText({ delta: "2.0", unit: "%" })).toBe("+2 pts");
  });
  test("negative numeric text uses a true minus and French decimal", () => {
    expect(deltaText({ delta: "-10.8", unit: null })).toBe("−10,8");
  });
  test("other delta units have a separating space, days are written out", () => {
    expect(deltaText({ delta: "3", unit: "kg" })).toBe("+3 kg");
    expect(deltaText({ delta: "3", unit: "j" })).toBe("+3 jours");
  });
  test("null, NaN and zero have no delta", () => {
    for (const delta of [null, NaN, "NaN", 0, "0.0"]) {
      expect(deltaText({ delta, unit: "%" })).toBe("");
    }
  });
  test("metric percentages use exactly one decimal with a space before the unit", () => {
    expect(formatMetricValue(38.6, "%")).toBe("38,6\u00a0%");
    expect(formatMetricValue(40, "%")).toBe("40,0\u00a0%");
  });
  test("metric values use at most one decimal, days written out", () => {
    expect(formatMetricValue(31, "j")).toBe("31\u00a0jours");
    expect(formatMetricValue("10.86", null)).toBe("10,9");
  });
  test("objectives drop useless decimals", () => {
    expect(formatObjectif(55, "%")).toBe("55\u00a0%");
    expect(formatObjectif(28, "j")).toBe("28\u00a0jours");
    expect(formatObjectif(75, null)).toBe("75");
  });
  test("objective keeps a space before any other unit, the number is never glued to the word", () => {
    expect(formatObjectif(28, "j")).toBe("28\u00a0jours");
    expect(formatObjectif(120, "h")).toBe("120\u00a0h");
    expect(formatObjectif(3, "kg")).toBe("3\u00a0kg");
    expect(formatObjectif("28", "j")).toMatch(/^28\u00a0jours$/);
    expect(formatMetricValue(2340, "h").endsWith("\u00a0h")).toBe(true);
  });
  test("dashboard order: position ascending, missing position last, then label", () => {
    const metrics = [
      { label: "Missions actives", dashboard_position: 4 },
      { label: "Zèbre", dashboard_position: null },
      { label: "Délai", dashboard_position: 2 },
      { label: "Taux", dashboard_position: 1 },
      { label: "Autre délai", dashboard_position: 2 },
    ];
    const ordre = [...metrics].sort(ordreAccueil).map((m) => m.label);
    expect(ordre).toEqual(["Taux", "Autre délai", "Délai", "Missions actives", "Zèbre"]);
  });
  test("trend is favourable or not depending on the direction of the metric", () => {
    expect(evaluerTendance({ trend: "hausse", higher_is_better: true })).toBe("favorable");
    expect(evaluerTendance({ trend: "hausse", higher_is_better: false })).toBe("defavorable");
    expect(evaluerTendance({ trend: "baisse", higher_is_better: false })).toBe("favorable");
    expect(evaluerTendance({ trend: "stable", higher_is_better: false })).toBe("stable");
  });
  test("trend line reads the change without the favourable word", () => {
    expect(libelleTendance({ trend: "hausse", delta: "2.0", unit: "%" })).toBe("En hausse, +2 pts");
    expect(libelleTendance({ trend: "baisse", delta: "-3", unit: "%" })).toBe("En baisse, −3 pts");
    expect(libelleTendance({ trend: "stable", delta: "0", unit: "%" })).toBe("Stable");
  });
  test("progress towards a target, capped at 100 %", () => {
    expect(progressionObjectif({ value: 40.6, target: 55, higher_is_better: true })).toEqual({
      ratio: 40.6 / 55,
      atteint: false,
    });
    expect(progressionObjectif({ value: 60, target: 55, higher_is_better: true })).toEqual({ ratio: 1, atteint: true });
  });
  test("lower-is-better progress is full at or below the target", () => {
    expect(progressionObjectif({ value: 31, target: 28, higher_is_better: false })).toEqual({
      ratio: 28 / 31,
      atteint: false,
    });
    expect(progressionObjectif({ value: 27, target: 28, higher_is_better: false })).toEqual({ ratio: 1, atteint: true });
  });
  test("no target, no progress", () => {
    expect(progressionObjectif({ value: 34, target: null, higher_is_better: true })).toBeNull();
  });
});

describe("short durations", () => {
  const now = Date.UTC(2026, 10, 2, 12, 0);
  const il = (ms) => new Date(now - ms).toISOString();
  test("days and hours are unit-only, minutes stay written out", () => {
    expect(decomposerDuree(il(5 * 86_400_000), now)).toEqual({ unite: "jour", n: 5 });
    expect(decomposerDuree(il(18 * 3_600_000), now)).toEqual({ unite: "heure", n: 18 });
    expect(decomposerDuree(il(42 * 60_000), now)).toEqual({ unite: "minute", n: 42 });
    expect(decomposerDuree(il(20_000), now)).toEqual({ unite: "instant" });
  });
});
