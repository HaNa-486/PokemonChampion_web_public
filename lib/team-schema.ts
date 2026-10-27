import { z } from 'zod';

const nonHpStat = z.enum(['attack', 'defense', 'specialAttack', 'specialDefense', 'speed']);
const statsSchema = z.object({ hp: z.number().int(), attack: z.number().int(), defense: z.number().int(), specialAttack: z.number().int(), specialDefense: z.number().int(), speed: z.number().int() });
const apSchema = statsSchema.refine(value => Object.values(value).every(amount => amount >= 0 && amount <= 32), 'Each AP must be between 0 and 32.').refine(value => Object.values(value).reduce((sum, amount) => sum + amount, 0) <= 66, 'Total AP cannot exceed 66.');
const natureSchema = z.object({ name: z.string().min(1), up: nonHpStat.nullable(), down: nonHpStat.nullable() }).refine(value => value.up === null && value.down === null || value.up !== value.down, 'Nature up/down stats must differ.');
export const teamMemberSchema = z.object({ id: z.string().min(1), pokemonId: z.string().min(1), moveIds: z.array(z.string()).max(4), abilityId: z.string().nullable(), itemId: z.string().nullable(), ap: apSchema, nature: natureSchema });
