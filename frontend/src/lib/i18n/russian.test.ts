// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { mount, tick, unmount } from "svelte";
import { chooseInitialLocale, formatDateTime, LOCALE_STORAGE_KEY, m } from "./index.js";
import { setLocale } from "../paraglide/runtime.js";
import en from "../../../messages/en.json";
import ru from "../../../messages/ru.json";
import findEn from "../../../messages/find/en.json";
import findRu from "../../../messages/find/ru.json";
import SummaryCards from "../components/analytics/SummaryCards.svelte";
import ActiveFilters from "../components/analytics/ActiveFilters.svelte";
import LanguageSettings from "../components/settings/LanguageSettings.svelte";
import { analytics } from "../stores/analytics.svelte.js";

beforeEach(() => localStorage.clear());

afterEach(() => {
  void setLocale("en", { reload: false });
  localStorage.clear();
  vi.unstubAllGlobals();
  analytics.selectedDate = null;
  analytics.selectedDow = null;
  analytics.selectedHour = null;
  document.body.innerHTML = "";
});

describe("Russian home localization", () => {
  it("detects Russian browser variants and respects the saved language", () => {
    vi.stubGlobal("navigator", { languages: ["ru-RU", "en-US"], language: "ru-RU" });
    expect(chooseInitialLocale()).toBe("ru");
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    expect(chooseInitialLocale()).toBe("en");
    localStorage.setItem(LOCALE_STORAGE_KEY, "ru");
    expect(chooseInitialLocale()).toBe("ru");
  });

  it.each([
    [0, "сессий"],
    [1, "сессия"],
    [2, "сессии"],
    [5, "сессий"],
    [11, "сессий"],
    [14, "сессий"],
    [21, "сессия"],
    [22, "сессии"],
    [25, "сессий"],
    [101, "сессия"],
    [1.5, "сессии"],
  ])("uses Russian plural rules for %s sessions", (count, noun) => {
    void setLocale("ru", { reload: false });
    const countLabel = count.toLocaleString("ru");
    expect(m.status_bar_sessions({ count, countLabel })).toBe(`${countLabel} ${noun}`);
    expect(m.analytics_project_sessions({ count, countLabel })).toBe(`${countLabel} ${noun}`);
  });

  it("inflects both counts in skill totals and search matches", () => {
    void setLocale("ru", { reload: false });
    expect(
      m.analytics_top_skills_count({ calls: 21, callsLabel: "21", skills: 5, skillsLabel: "5" }),
    ).toBe("21 вызов · 5 навыков");
    expect(
      m.analytics_top_skills_count({ calls: 12, callsLabel: "12", skills: 2, skillsLabel: "2" }),
    ).toBe("12 вызовов · 2 навыка");
    expect(m.session_find_block_count({ count: 1 })).toBe("1 совпадение");
    expect(m.session_find_block_count({ count: 22 })).toBe("22 совпадения");
    expect(m.session_find_rail_label({ count: 11 })).toBe("11 совпадений в этой сессии");
    expect(m.shared_range_last_days({ count: 1 })).toBe("За последний 1 день");
    expect(m.shared_range_last_days({ count: 2 })).toBe("За последние 2 дня");
    expect(m.shared_range_last_days({ count: 30 })).toBe("За последние 30 дней");
  });

  it("preserves message inputs and placeholders in both catalogs", () => {
    function inputs(value: unknown): string[] {
      if (typeof value === "string") return [...new Set(value.match(/\{\w+\}/g) ?? [])].sort();
      if (!Array.isArray(value)) return [];
      return [
        ...new Set(
          value.flatMap((variant) => [
            ...(variant.declarations ?? []),
            ...Object.values(variant.match ?? {}).flatMap((text) => inputs(text)),
          ]),
        ),
      ].sort((a, b) => String(a).localeCompare(String(b))) as string[];
    }
    const catalogs: [Record<string, unknown>, Record<string, unknown>][] = [
      [en, ru],
      [findEn, findRu],
    ];
    for (const [english, russian] of catalogs) {
      expect(Object.keys(russian).sort()).toEqual(Object.keys(english).sort());
      for (const key of Object.keys(english)) {
        expect(inputs(russian[key]), key).toEqual(inputs(english[key]));
      }
    }
  });

  it("renders home summary labels and the Russian language option", async () => {
    void setLocale("ru", { reload: false });
    localStorage.setItem(LOCALE_STORAGE_KEY, "ru");
    const summary = mount(SummaryCards, { target: document.body });
    const language = mount(LanguageSettings, { target: document.body });
    try {
      await tick();
      expect(document.body.textContent).toContain("Сессии");
      expect(document.body.textContent).toContain("Сообщения");
      expect(document.body.textContent).toContain("Дни активности");
      expect(document.body.textContent).toContain("Язык интерфейса");
      expect(document.body.textContent).toContain("Русский");
    } finally {
      await unmount(summary);
      await unmount(language);
    }
  });

  it("renders Russian date and weekday filters when the browser is English", async () => {
    vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
    void setLocale("ru", { reload: false });
    analytics.selectedDate = "2026-01-15";
    analytics.selectedDow = 0;
    analytics.selectedHour = 9;
    const filters = mount(ActiveFilters, { target: document.body });
    try {
      await tick();
      expect(document.body.textContent).toContain("Пн 09:00");
      expect(document.body.textContent).toContain(
        formatDateTime("2026-01-15T00:00:00", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
      expect(document.body.textContent).not.toContain("Jan");
    } finally {
      await unmount(filters);
    }
  });
});
