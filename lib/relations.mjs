export function detachCreator(data, influencerId) {
  const result = { ...data };
  let changed = false;
  if (result.influencerId === influencerId) { result.influencerId = ''; changed = true; }
  if (result.reference === influencerId) { result.reference = ''; changed = true; }
  if (Array.isArray(result.influencerIds) && result.influencerIds.includes(influencerId)) {
    result.influencerIds = result.influencerIds.filter(value => value !== influencerId);
    changed = true;
  }
  return changed ? result : null;
}
