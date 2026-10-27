export type StatName = "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";
export type NonHpStat = Exclude<StatName, "hp">;
export type Stats = Record<StatName, number>;
export type BattleFormat = "singles" | "doubles";

export type Nature = { name: string; nameZh?: string; up: NonHpStat | null; down: NonHpStat | null };

export type PokemonType = "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice" | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug" | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export type Move = {
  id: string; name: string; nameZh: string; type: PokemonType;
  category: "Physical" | "Special" | "Status";
  power: number | null; accuracy: number | null; pp: number; priority: number;
  target: string; flags: string[]; description: string; descriptionZh: string;
};

export type Ability = { id: string; name: string; nameZh: string; description: string; descriptionZh: string };
export type HeldItem = { id: string; name: string; nameZh: string; category: string; description: string; descriptionZh: string; imageUrl: string | null };

export type Pokemon = {
  id: string; speciesKey: string; battleDataKey?: string; name: string; nameZh: string; types: PokemonType[];
  baseStats: Stats; imageUrl: string; abilityIds: string[]; moveIds: string[];
  isMega?: boolean; legal?: boolean;
};

export type BattleUsageRow = {
  category: string; rank: number; name: string; percentage: string;
  percentageValue: number | null; statUp: string; statDown: string;
  ap: Stats | null;
};

export type BattleUsage = {
  pokemon: string; format: "Singles" | "Doubles"; season: string;
  date: string | null; source: string; rows: BattleUsageRow[];
  fetchedAt?: string; sourceVersion?: string | null;
  provenance?: import('./usage-contract').UsageProvenance;
  missingCategories?: string[];
  ignoredCategories?: string[];
  rankGaps?: Array<{ category: string; missingRanks: number[] }>;
};

export type TeamMember = {
  id: string; pokemonId: string; moveIds: string[]; abilityId: string | null;
  itemId: string | null; ap: Stats; nature: Nature;
};
