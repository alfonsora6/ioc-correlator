import { Globe } from "lucide-react";
import { useI18n, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageSelector({ className, compact }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!compact && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Globe className="h-3.5 w-3.5" />
          {t("lang.label")}
        </span>
      )}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("lang.label")}
        className="h-9 cursor-pointer rounded-lg border border-subtle bg-surface px-2.5 text-sm text-primary shadow-sm transition hover:border-brand-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <option value="es">{t("lang.es")}</option>
        <option value="en">{t("lang.en")}</option>
      </select>
    </div>
  );
}
