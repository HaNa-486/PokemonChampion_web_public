type Locale = "en" | "zh-Hant";

export function ResetFiltersButton({ locale, onClick }: { locale: Locale; onClick: () => void }) {
  return <button type="button" className="clear-filters" onClick={onClick}>
    <span className="clear-filters-icon" aria-hidden="true">↺</span>
    <span>{locale === "zh-Hant" ? "重設篩選" : "Reset filters"}</span>
  </button>;
}
