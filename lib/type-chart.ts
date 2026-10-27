import type { PokemonType } from "./types";

export const ALL_TYPES: PokemonType[] = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

const modifiers: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  Normal: { Rock: .5, Ghost: 0, Steel: .5 },
  Fire: { Fire: .5, Water: .5, Grass: 2, Ice: 2, Bug: 2, Rock: .5, Dragon: .5, Steel: 2 },
  Water: { Fire: 2, Water: .5, Grass: .5, Ground: 2, Rock: 2, Dragon: .5 },
  Electric: { Water: 2, Electric: .5, Grass: .5, Ground: 0, Flying: 2, Dragon: .5 },
  Grass: { Fire: .5, Water: 2, Grass: .5, Poison: .5, Ground: 2, Flying: .5, Bug: .5, Rock: 2, Dragon: .5, Steel: .5 },
  Ice: { Fire: .5, Water: .5, Grass: 2, Ice: .5, Ground: 2, Flying: 2, Dragon: 2, Steel: .5 },
  Fighting: { Normal: 2, Ice: 2, Poison: .5, Flying: .5, Psychic: .5, Bug: .5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: .5 },
  Poison: { Grass: 2, Poison: .5, Ground: .5, Rock: .5, Ghost: .5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: .5, Poison: 2, Flying: 0, Bug: .5, Rock: 2, Steel: 2 },
  Flying: { Electric: .5, Grass: 2, Fighting: 2, Bug: 2, Rock: .5, Steel: .5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: .5, Dark: 0, Steel: .5 },
  Bug: { Fire: .5, Grass: 2, Fighting: .5, Poison: .5, Flying: .5, Psychic: 2, Ghost: .5, Dark: 2, Steel: .5, Fairy: .5 },
  Rock: { Fire: 2, Ice: 2, Fighting: .5, Ground: .5, Flying: 2, Bug: 2, Steel: .5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: .5 },
  Dragon: { Dragon: 2, Steel: .5, Fairy: 0 },
  Dark: { Fighting: .5, Psychic: 2, Ghost: 2, Dark: .5, Fairy: .5 },
  Steel: { Fire: .5, Water: .5, Electric: .5, Ice: 2, Rock: 2, Steel: .5, Fairy: 2 },
  Fairy: { Fire: .5, Fighting: 2, Poison: .5, Dragon: 2, Dark: 2, Steel: .5 },
};

export function typeEffectiveness(attacking: PokemonType, defending: PokemonType) {
  return modifiers[attacking]?.[defending] ?? 1;
}

export type TypeMatchup = { type: PokemonType; multiplier: number };

export function defensiveMatchups(defenderTypes: PokemonType[]) {
  const values = ALL_TYPES.map((type) => ({ type, multiplier: defenderTypes.reduce((result, defender) => result * typeEffectiveness(type, defender), 1) }));
  const byTypeOrder = (left: TypeMatchup, right: TypeMatchup) => ALL_TYPES.indexOf(left.type) - ALL_TYPES.indexOf(right.type);
  return {
    immune: values.filter((entry) => entry.multiplier === 0),
    resistant: values.filter((entry) => entry.multiplier > 0 && entry.multiplier < 1).sort((left, right) => left.multiplier - right.multiplier || byTypeOrder(left, right)),
    weak: values.filter((entry) => entry.multiplier > 1).sort((left, right) => right.multiplier - left.multiplier || byTypeOrder(left, right)),
  };
}

export const formatMultiplier = (value: number) => value === .25 ? "¼×" : value === .5 ? "½×" : `${value}×`;
