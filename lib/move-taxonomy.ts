/** Champions move families, independent of engine interaction flags. */
export const MOVE_FAMILIES = ["Punch", "Sound", "Dance", "Slicing", "Wind", "Powder", "Ballistics", "Pulse", "Bite", "Explosion", "Mental", "Heal"];
export const isMoveFamily = (flag: string) => MOVE_FAMILIES.includes(flag);
