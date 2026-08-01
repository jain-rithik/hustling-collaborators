import { prisma } from '../lib/prisma.js';

/**
 * Return a random active meme line for an event. The no-repeat-twice-in-a-row rule is enforced
 * client-side (PRD §6.5); passing `exclude` (the last shown line) lets the server help avoid it.
 */
export async function randomMeme(eventKey: string, exclude?: string): Promise<string | null> {
  const lines = await prisma.memeLine.findMany({
    where: { eventKey, isActive: true },
    select: { text: true },
  });
  if (lines.length === 0) return null;
  const pool = exclude && lines.length > 1 ? lines.filter((l) => l.text !== exclude) : lines;
  const arr = pool.length ? pool : lines;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx]!.text;
}
