const COMPLETED_TASKS_STORAGE_PREFIX = "humanRobotExperiment.completedTaskPhaseTasks";

const TASK_DISPLAY_NAMES = {
  making_coffee: "Make a cup of coffee",
  can_meat: "Prepare a can of tuna",
  chopping_vegetables: "Slice a carrot",
  heating_food_microwave: "Heat food with the microwave",
  pick_up_trash: "Throw trash into the trash can",
  boxing_books: "Put away books on the sofa",
  clean_tv: "Clean the TV screen",
  light_candle: "Light the scented candle",

  turn_on_work_table_light: "Turn on the work table light",
  hang_up_paint: "Hang up the painting",
  pick_laptop_to_work_table: "Put the laptop on the work table",
  place_vase_top_shelf: "Place the antique vase on the second shelf from the top",
  sort_tools_to_toolbox: "Put the tools into the toolbox",
  put_leftovers_in_fridge: "Put the leftovers in the fridge",
  replace_floor_lamp_bulb: "Replace the work table lamp bulb",
  spray_insecticide_houseplant: "Spray insecticide on the houseplant"
};

export function getStoredCompletedTaskPhaseTasks(sessionId) {
  if (!sessionId || typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(getCompletedTasksStorageKey(sessionId));
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function recordCompletedTaskPhaseTask(sessionId, taskRecord) {
  if (!sessionId || typeof window === "undefined") {
    return [];
  }

  const currentTasks = getStoredCompletedTaskPhaseTasks(sessionId);
  const normalizedRecord = normalizeTaskRecord(taskRecord);
  const recordKey = getCompletedTaskPhaseTaskKey(normalizedRecord);
  const existingIndex = currentTasks.findIndex(
    (task) => getCompletedTaskPhaseTaskKey(task) === recordKey
  );
  const nextTasks =
    existingIndex >= 0
      ? currentTasks.map((task, index) =>
          index === existingIndex ? { ...task, ...normalizedRecord } : task
        )
      : [...currentTasks, normalizedRecord];

  window.localStorage.setItem(
    getCompletedTasksStorageKey(sessionId),
    JSON.stringify(nextTasks)
  );
  return nextTasks;
}

export function clearStoredCompletedTaskPhaseTasksForPhase(sessionId, phase) {
  if (!sessionId || !phase || typeof window === "undefined") {
    return [];
  }

  const remainingTasks = getStoredCompletedTaskPhaseTasks(sessionId).filter(
    (task) => task.phase !== phase
  );

  window.localStorage.setItem(
    getCompletedTasksStorageKey(sessionId),
    JSON.stringify(remainingTasks)
  );
  return remainingTasks;
}

export function getCompletedTaskPhaseTaskKey(taskRecord, fallbackIndex = 0) {
  const taskId = normalizeTaskId(taskRecord?.taskId);
  const phase = taskRecord?.phase || "unknown_phase";
  const taskIndex = Number(taskRecord?.taskIndex) || fallbackIndex + 1;
  const condition = taskRecord?.condition || "fixed";
  return `${phase}-${taskIndex}-${taskId || "unknown_task"}-${condition}`;
}

export function getTaskPhaseTaskDisplayName(taskId) {
  const normalizedTaskId = normalizeTaskId(taskId);
  return TASK_DISPLAY_NAMES[normalizedTaskId] || normalizedTaskId || "Task";
}

function getCompletedTasksStorageKey(sessionId) {
  return `${COMPLETED_TASKS_STORAGE_PREFIX}:${sessionId}`;
}

function normalizeTaskRecord(taskRecord) {
  const taskId = normalizeTaskId(taskRecord?.taskId);
  return {
    taskId,
    taskLabel: getTaskPhaseTaskDisplayName(taskId),
    taskIndex: Number(taskRecord?.taskIndex) || 0,
    taskCount: Number(taskRecord?.taskCount) || 0,
    phase: taskRecord?.phase || "",
    condition: taskRecord?.condition || "",
    outcome: taskRecord?.outcome || "",
    taskResponseCondition: taskRecord?.taskResponseCondition || "",
    completedAtBrowser: taskRecord?.completedAtBrowser || ""
  };
}

function normalizeTaskId(taskId) {
  return String(taskId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
