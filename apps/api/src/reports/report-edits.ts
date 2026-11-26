type Json = Record<string, unknown>;
type Item = Record<string, unknown>;

// Chaves de edição: workday.<campo>, weather.<turno>.<campo>, equipment.<id>.<campo> e
// openItemReviews.<id>; os outros blocos contam inteiros (labor, activities...).
const WHOLE = ["weatherStoppage", "rainfallMm", "labor", "laborNotes", "activities", "occurrences", "newOpenItems"];
const WORKDAY = ["startTime", "endTime", "breakMinutes"];
const WEATHER = ["weather", "condition"];
const EQUIPMENT = ["status", "operatingHours"];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const record = (value: unknown): Item => (typeof value === "object" && value !== null ? (value as Item) : {});
const list = (value: unknown): Item[] => (Array.isArray(value) ? (value as Item[]) : []);
const find = (items: unknown, key: string, id: unknown) => list(items).find((x) => x[key] === id);

export function isEdited(edited: readonly string[], path: string) {
  return edited.some((key) => path === key || path.startsWith(`${key}.`));
}

export function editedKeys(before: Json, after: Json): string[] {
  const keys = WHOLE.filter((k) => !same(before[k], after[k]));
  for (const leaf of WORKDAY) if (!same(record(before.workday)[leaf], record(after.workday)[leaf])) keys.push(`workday.${leaf}`);
  for (const shift of new Set([...list(before.weather), ...list(after.weather)].map((w) => String(w.shift)))) {
    for (const leaf of WEATHER) if (!same(find(before.weather, "shift", shift)?.[leaf], find(after.weather, "shift", shift)?.[leaf])) keys.push(`weather.${shift}.${leaf}`);
  }
  for (const id of new Set([...list(before.equipment), ...list(after.equipment)].map((e) => String(e.equipmentId)))) {
    for (const leaf of EQUIPMENT) if (!same(find(before.equipment, "equipmentId", id)?.[leaf], find(after.equipment, "equipmentId", id)?.[leaf])) keys.push(`equipment.${id}.${leaf}`);
  }
  for (const id of new Set([...list(before.openItemReviews), ...list(after.openItemReviews)].map((r) => String(r.openItemId)))) {
    if (!same(find(before.openItemReviews, "openItemId", id), find(after.openItemReviews, "openItemId", id))) keys.push(`openItemReviews.${id}`);
  }
  return keys;
}

export function mergeEdited(edited: readonly string[], ...keys: string[][]) {
  return [...new Set([...edited, ...keys.flat()])];
}

export function keepEdited<T extends Json>(fresh: T, old: Json, edited: readonly string[]): T {
  const has = (path: string) => isEdited(edited, path);
  const out: Json = { ...fresh };
  for (const key of WHOLE) if (has(key)) out[key] = old[key];
  out.workday = Object.fromEntries(WORKDAY.map((leaf) => [leaf, (has(`workday.${leaf}`) ? record(old.workday) : record(fresh.workday))[leaf] ?? null]));
  out.weather = list(fresh.weather).map((w) => {
    const before = find(old.weather, "shift", w.shift);
    return { ...w, ...Object.fromEntries(WEATHER.map((leaf) => [leaf, has(`weather.${String(w.shift)}.${leaf}`) ? (before?.[leaf] ?? null) : (w[leaf] ?? null)])) };
  });
  out.equipment = list(fresh.equipment).map((e) => {
    const before = find(old.equipment, "equipmentId", e.equipmentId);
    return { ...e, ...Object.fromEntries(EQUIPMENT.map((leaf) => [leaf, has(`equipment.${String(e.equipmentId)}.${leaf}`) ? (before?.[leaf] ?? null) : (e[leaf] ?? null)])) };
  });
  out.openItemReviews = [
    ...list(fresh.openItemReviews).filter((r) => !has(`openItemReviews.${String(r.openItemId)}`)),
    ...list(old.openItemReviews).filter((r) => has(`openItemReviews.${String(r.openItemId)}`)),
  ];
  return out as T;
}

export function keepPhotoEdits<T extends Json>(fresh: T, old: Json): T {
  return {
    ...fresh,
    photos: list(fresh.photos).map((p) => {
      const before = find(old.photos, "id", p.id);
      return { ...p, caption: before?.caption ?? null, linkedTo: before?.linkedTo ?? null };
    }),
  };
}

export function dropDanglingLinks<T extends Json>(content: T): T {
  const targets = new Set([...list(content.activities).map((a) => `activity:${String(a.id)}`), ...list(content.occurrences).map((o) => `occurrence:${String(o.id)}`)]);
  return {
    ...content,
    photos: list(content.photos).map((p) => {
      const link = p.linkedTo as { type: string; id: string } | null;
      return link && !targets.has(`${link.type}:${link.id}`) ? { ...p, linkedTo: null } : p;
    }),
  };
}
