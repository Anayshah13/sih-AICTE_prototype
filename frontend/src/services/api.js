const getDefaultApiBase = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || getDefaultApiBase();

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch health check:', err);
    return { status: 'offline', depth_model: { ready: false } };
  }
}

export async function fetchRequirements() {
  try {
    const res = await fetch(`${API_BASE}/requirements`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch AICTE requirements:', err);
    throw err;
  }
}

export async function updateRequirement(roomKey, requirementsData) {
  try {
    const res = await fetch(`${API_BASE}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_key: roomKey,
        requirements: requirementsData
      })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to update requirement:', err);
    throw err;
  }
}
