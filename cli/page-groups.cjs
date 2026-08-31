function samePageVisit(previous, current) {
  if (!previous || previous.url !== current.url) return false;
  return !previous.documentToken || !current.documentToken || previous.documentToken === current.documentToken;
}

function latestPageGroups(session) {
  const groups = [];
  const sources = new Map((session.groups || []).map(group => [group.id, group]));
  for (const step of session.steps || []) {
    const source = sources.get(step.groupId);
    let group = groups.at(-1);
    if (!group || session.config?.recording?.separateScreens || !samePageVisit(group.page, step.page)) {
      group = { id: step.id, stepIds: [] };
      groups.push(group);
    }
    group.stepIds.push(step.id);
    group.page = step.page;
    group.screenshot = step.images?.screen || source?.screenshot;
    group.latestStepId = step.id;
    group.markerRects = step.markerRects || {};
  }
  return groups;
}

module.exports = { latestPageGroups, samePageVisit };
