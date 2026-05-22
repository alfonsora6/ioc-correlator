import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useThemeStore } from "@/store/theme";
import { Moon, SunMedium } from "lucide-react";

type Props = {
  children: ReactNode;
};

export function AuthLayout({ children }: Props) {
  const { t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-primary">{t("app.name")}</div>
            <div className="text-xs text-muted">{t("app.tagline")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <Button type="button" variant="outline" size="sm" onClick={toggleTheme} aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}>
            {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
