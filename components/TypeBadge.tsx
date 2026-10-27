import type { PokemonType } from "../lib/types";
import { localizedType, type Locale } from "../lib/localization";

export function TypeBadge({ type, locale = "en" }: { type: PokemonType; locale?: Locale }) {
  return <span className={`type-badge type-${type.toLowerCase()}`}>{localizedType(type, locale)}</span>;
}
