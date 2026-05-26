export function isNoRoomTourCondition(condition) {
  const normalizedCondition = normalizeRoomTourCondition(condition);

  return (
    normalizedCondition === "false" ||
    normalizedCondition === "false_condition" ||
    normalizedCondition === "no_room_tour"
  );
}

export function isRobotLeadCondition(condition) {
  const normalizedCondition = normalizeRoomTourCondition(condition);

  return normalizedCondition === "robot_lead" || normalizedCondition === "robotlead";
}

export function normalizeRoomTourCondition(condition) {
  return (condition || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}
