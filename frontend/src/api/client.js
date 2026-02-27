const BASE_URL = "";
const SERVER_DOWN_MSG = "백엔드 서버에 연결할 수 없습니다. uvicorn이 실행 중인지 확인해주세요.";

/** 응답 상태 코드에 맞는 에러 메시지를 만들어 throw */
async function throwFromResponse(res) {
  // 502/503/504 = 프록시가 백엔드에 연결 못 한 것
  if ([502, 503, 504].includes(res.status)) {
    throw new Error(SERVER_DOWN_MSG);
  }
  // JSON 응답이면 FastAPI detail 필드 사용
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    if (typeof detail === "string") throw new Error(detail);
    // 422 Unprocessable Entity 등 detail이 배열인 경우
    if (Array.isArray(detail)) throw new Error("입력값을 확인해주세요.");
  }
  throw new Error(`오류가 발생했습니다. (${res.status})`);
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(SERVER_DOWN_MSG);
  }

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) await throwFromResponse(res);
  if (res.status === 204) return null;
  return res.json();
}

export async function apiLogin(email, password) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  let res;
  try {
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
  } catch {
    throw new Error(SERVER_DOWN_MSG);
  }

  if (!res.ok) await throwFromResponse(res);
  return res.json();
}

export async function apiRegister(email, password, nickname) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, ...(nickname ? { nickname } : {}) }),
  });
}

export const goalsApi = {
  list: () => apiFetch("/goals"),
  create: (text, type) => apiFetch("/goals", { method: "POST", body: JSON.stringify({ text, type }) }),
  bulk: (goals) => apiFetch("/goals/bulk", { method: "POST", body: JSON.stringify({ goals }) }),
  delete: (id) => apiFetch(`/goals/${id}`, { method: "DELETE" }),
};

export const friendsApi = {
  search: (nickname) => apiFetch(`/friends/search?nickname=${encodeURIComponent(nickname)}`),
  sendRequest: (friend_id) => apiFetch("/friends/request", { method: "POST", body: JSON.stringify({ friend_id }) }),
  listRequests: () => apiFetch("/friends/requests"),
  acceptRequest: (id) => apiFetch(`/friends/requests/${id}/accept`, { method: "POST" }),
  declineRequest: (id) => apiFetch(`/friends/requests/${id}`, { method: "DELETE" }),
  list: () => apiFetch("/friends"),
  remove: (friendship_id) => apiFetch(`/friends/${friendship_id}`, { method: "DELETE" }),
  getFriendTasks: (friend_id) => apiFetch(`/friends/${friend_id}/tasks`),
};

export const groupsApi = {
  list: () => apiFetch("/groups"),
  create: (name) => apiFetch("/groups", { method: "POST", body: JSON.stringify({ name }) }),
  get: (id) => apiFetch(`/groups/${id}`),
  addMember: (group_id, user_id) => apiFetch(`/groups/${group_id}/members`, { method: "POST", body: JSON.stringify({ user_id }) }),
  removeMember: (group_id, user_id) => apiFetch(`/groups/${group_id}/members/${user_id}`, { method: "DELETE" }),
  getFeed: (group_id) => apiFetch(`/groups/${group_id}/feed`),
};

export const setNickname = (nickname) =>
  apiFetch("/auth/me/nickname", { method: "PUT", body: JSON.stringify({ nickname }) });

export const logsApi = {
  create: (type, value, meta, note, timestamp) =>
    apiFetch("/logs", {
      method: "POST",
      body: JSON.stringify({ type, value, meta, note, ...(timestamp ? { timestamp } : {}) }),
    }),
  list: ({ type, date_from, date_to, limit } = {}) => {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (date_from) params.append("date_from", date_from);
    if (date_to) params.append("date_to", date_to);
    if (limit) params.append("limit", limit);
    return apiFetch(`/logs?${params.toString()}`);
  },
  delete: (id) => apiFetch(`/logs/${id}`, { method: "DELETE" }),
};

export const lifeScoresApi = {
  today: () => apiFetch("/life-scores/today"),
  list: ({ date_from, date_to } = {}) => {
    const params = new URLSearchParams();
    if (date_from) params.append("date_from", date_from);
    if (date_to) params.append("date_to", date_to);
    return apiFetch(`/life-scores?${params.toString()}`);
  },
  compute: (target_date) => {
    const params = target_date ? `?target_date=${target_date}` : "";
    return apiFetch(`/life-scores/compute${params}`, { method: "POST" });
  },
  aggregates: ({ date_from, date_to } = {}) => {
    const params = new URLSearchParams();
    if (date_from) params.append("date_from", date_from);
    if (date_to) params.append("date_to", date_to);
    return apiFetch(`/life-scores/aggregates?${params.toString()}`);
  },
};

export const twinnyApi = {
  summary: (target_date) => {
    const params = target_date ? `?target_date=${target_date}` : "";
    return apiFetch(`/twinny/summary${params}`);
  },
};

export const simulationApi = {
  whatIf: (changes, horizon_days = 7) =>
    apiFetch("/simulation/what-if", {
      method: "POST",
      body: JSON.stringify({ changes, horizon_days }),
    }),
};

export const transactionsApi = {
  list: (year, month) =>
    apiFetch(`/transactions?year=${year}&month=${month}`),
  listByDate: (date) =>
    apiFetch(`/transactions?date=${date}`),
  create: ({ type, date, amount, category, memo }) =>
    apiFetch("/transactions", {
      method: "POST",
      body: JSON.stringify({ type, date, amount, category, memo }),
    }),
  delete: (id) => apiFetch(`/transactions/${id}`, { method: "DELETE" }),
  summary: (year, month) =>
    apiFetch(`/transactions/summary?year=${year}&month=${month}`),
};

export const taskCommentsApi = {
  list: (taskId) => apiFetch(`/tasks/${taskId}/comments`),
  create: (taskId, content, parent_id = null) =>
    apiFetch(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parent_id }),
    }),
  delete: (taskId, commentId) =>
    apiFetch(`/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
};

export const projectsApi = {
  list: () => apiFetch("/projects"),
  create: ({ goal_id, title, description, deadline }) =>
    apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify({ goal_id, title, description, deadline }),
    }),
  update: (id, data) =>
    apiFetch(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => apiFetch(`/projects/${id}`, { method: "DELETE" }),
  addTask: (project_id, { title, estimated_hours, difficulty, order_index }) =>
    apiFetch(`/projects/${project_id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title, estimated_hours, difficulty, order_index }),
    }),
  updateTask: (project_id, task_id, data) =>
    apiFetch(`/projects/${project_id}/tasks/${task_id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTask: (project_id, task_id) =>
    apiFetch(`/projects/${project_id}/tasks/${task_id}`, { method: "DELETE" }),
  twinnyFeedback: (project_id) =>
    apiFetch(`/projects/${project_id}/twinny-feedback`, { method: "POST" }),
};

export const friendsLogsApi = {
  list: ({ types, log_date } = {}) => {
    const params = new URLSearchParams();
    if (types) types.forEach((t) => params.append("types", t));
    if (log_date) params.append("log_date", log_date);
    return apiFetch(`/logs/friends?${params.toString()}`);
  },
};

export const groupGoalsApi = {
  list: (gid) => apiFetch(`/groups/${gid}/goals`),
  create: (gid, data) =>
    apiFetch(`/groups/${gid}/goals`, { method: "POST", body: JSON.stringify(data) }),
  delete: (gid, goalId) =>
    apiFetch(`/groups/${gid}/goals/${goalId}`, { method: "DELETE" }),
};

export const groupProjectsApi = {
  list: (gid) => apiFetch(`/groups/${gid}/projects`),
  create: (gid, data) =>
    apiFetch(`/groups/${gid}/projects`, { method: "POST", body: JSON.stringify(data) }),
  update: (gid, pid, data) =>
    apiFetch(`/groups/${gid}/projects/${pid}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (gid, pid) =>
    apiFetch(`/groups/${gid}/projects/${pid}`, { method: "DELETE" }),
  addTask: (gid, pid, data) =>
    apiFetch(`/groups/${gid}/projects/${pid}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  updateTask: (gid, pid, tid, data) =>
    apiFetch(`/groups/${gid}/projects/${pid}/tasks/${tid}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (gid, pid, tid) =>
    apiFetch(`/groups/${gid}/projects/${pid}/tasks/${tid}`, { method: "DELETE" }),
  aiFeedback: (gid, pid) =>
    apiFetch(`/groups/${gid}/projects/${pid}/ai-feedback`, { method: "POST" }),
};

export const groupStatsApi = {
  get: (gid) => apiFetch(`/groups/${gid}/stats`),
};

export const planApi = {
  createDraft: (plan_name, changes, horizon_days) =>
    apiFetch("/plan/drafts", {
      method: "POST",
      body: JSON.stringify({ plan_name, changes, horizon_days }),
    }),
  listDrafts: () => apiFetch("/plan/drafts"),
  getDraft: (id) => apiFetch(`/plan/drafts/${id}`),
  updateDraft: (id, events) =>
    apiFetch(`/plan/drafts/${id}`, {
      method: "PUT",
      body: JSON.stringify(events),
    }),
  applyDraft: (id) =>
    apiFetch(`/plan/drafts/${id}/apply`, { method: "POST" }),
};
