/** Active Project memberships of a Saved entity as returned by
 * consumer.list_saved_entities(). A NULL element is never a membership: the
 * unpatched aggregate returns {NULL} for an entity that is in no Project. */
export function savedProjectIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}
