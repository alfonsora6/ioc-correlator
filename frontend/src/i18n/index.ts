import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en } from "./en";
import { es } from "./es";

export type Locale = "es" | "en";

const catalogs = { es, en } as const;

type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<typeof es>;

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(locale: Locale, key: TranslationKey, vars?: Record<string, string>): string {
  let text = getNested(catalogs[locale] as unknown as Record<string, unknown>, key) ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "es",
      setLocale: (locale) => {
        set({ locale });
        document.documentElement.lang = locale;
      },
    }),
    { name: "ioc-locale", partialize: (s) => ({ locale: s.locale }) },
  ),
);

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = (key: TranslationKey, vars?: Record<string, string>) => translate(locale, key, vars);
  return { locale, setLocale, t };
}
