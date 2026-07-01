// src/utils/api.ts

export interface Scene {
  scene_number: number;
  title: string;
  text: string;
  narration: string;
  setting: string;
  location: string;
  mood: string;
  image_prompt: string;
  characters_present: string[];
  duration_hint: number | null;
  image_path: string | null;
  audio_path: string | null;
  subtitle_path: string | null;
}

export interface JobStatusResponse {
  job_id: string;
  status: string; // pending | analyzing | generating_images | generating_voice | generating_subtitles | composing_video | generating_metadata | generating_thumbnail | completed | failed
  progress_percent: number;
  current_step: string | null;
  story_filename: string | null;
  created_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  scenes: Scene[] | null;
  logs?: string[];
}

export interface JobSummary {
  job_id: string;
  status: string;
  progress_percent: number;
  story_filename: string | null;
  created_at: string;
  user_id?: string | null;
  username?: string | null;
}

export interface JobListResponse {
  jobs: JobSummary[];
  total: number;
}

export interface JobOutputLinks {
  job_id: string;
  episode_mp4: string | null;
  thumbnail_png: string | null;
  character_bible_md: string | null;
  title_txt: string | null;
  description_txt: string | null;
  hashtags_txt: string | null;
  subtitles_srt: string | null;
  thumbnail_prompt_txt: string | null;
}

const BASE_URL_DYNAMIC = {
  toString() {
    if (typeof window !== 'undefined') {
      const offline = localStorage.getItem('storyforge_server_offline') === 'true';
      if (offline) {
        return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      }
      const stored = localStorage.getItem('storyforge_api_url');
      if (stored === 'http://127.0.0.1:8000' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        localStorage.removeItem('storyforge_api_url');
        return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      }
      return stored || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    }
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  },
  replace(searchValue: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)) {
    const url = typeof window !== 'undefined'
      ? (() => {
          const offline = localStorage.getItem('storyforge_server_offline') === 'true';
          if (offline) {
            return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
          }
          const stored = localStorage.getItem('storyforge_api_url');
          if (stored === 'http://127.0.0.1:8000' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            localStorage.removeItem('storyforge_api_url');
            return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
          }
          return stored || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        })()
      : process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    // @ts-ignore
    return url.replace(searchValue, replaceValue);
  }
};
export const BASE_URL = BASE_URL_DYNAMIC as unknown as string;

export function getAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('storyforge_token');
    if (token) {
      return {
        ...headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }
  return headers;
}

export interface UserResponse {
  id: string;
  username: string;
  role: string;
  full_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  avatar_data?: string;
  pollen_balance?: number;
  last_seen?: string;
  is_active?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
}

/**
 * Log in to receive a JWT access token
 */
export async function login(username: string, password: string): Promise<TokenResponse> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Incorrect username or password.');
  }

  const data: TokenResponse = await response.json();
  if (typeof window !== 'undefined') {
    localStorage.setItem('storyforge_token', data.access_token);
    localStorage.setItem('storyforge_role', data.role);
    localStorage.setItem('storyforge_username', username);
  }
  return data;
}

/**
 * Register a new user account
 */
export async function register(username: string, password: string): Promise<UserResponse> {
  const response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Registration failed. Username may be taken.');
  }

  return response.json();
}

/**
 * Log out user by clearing tokens from localStorage
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('storyforge_token');
    localStorage.removeItem('storyforge_role');
    localStorage.removeItem('storyforge_username');
  }
}

/**
 * Fetch all registered users (Admin only)
 */
export async function fetchAdminUsers(): Promise<UserResponse[]> {
  const response = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch users list.');
  }
  return response.json();
}

/**
 * Delete a user profile (Admin only)
 */
export async function deleteAdminUser(userId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to delete user.');
  }
  return response.json();
}

/**
 * Retrieve system logs (Admin only)
 */
export async function fetchAdminLogs(): Promise<{ success: boolean; logs: string[] }> {
  const response = await fetch(`${BASE_URL}/api/admin/logs`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch uvicorn/backend system logs.');
  }
  return response.json();
}

export interface SystemAnalytics {
  renders: {
    completed: number;
    failed: number;
    avg_duration: number;
    avg_steps: {
      analyzing: number;
      generating_images: number;
      generating_voice: number;
      generating_subtitles: number;
      composing_video: number;
      generating_metadata: number;
      generating_thumbnail: number;
    };
    max_memory: number;
    avg_memory: number;
    recent: Array<{
      id: string;
      job_id: string;
      username: string | null;
      total_duration: number;
      peak_memory_mb: number;
      status: string;
      created_at: string;
    }>;
  };
  failures: Array<{
    id: string;
    job_id: string;
    username: string | null;
    total_duration: number;
    status: string;
    error_message: string;
    ffmpeg_cmd: string | null;
    ffmpeg_stderr: string | null;
    created_at: string;
  }>;
  users: {
    total_registered: number;
    active_24h: number;
    active_30d: number;
    conversion_rate: number;
  };
  credits: {
    total_held: number;
    total_consumed: number;
    total_requested: number;
    total_approved: number;
    total_denied: number;
    by_user: Array<{
      username: string;
      consumed: number;
    }>;
  };
}

/**
 * Retrieve system analytics (Admin only)
 */
export async function fetchAdminAnalytics(): Promise<SystemAnalytics> {
  const response = await fetch(`${BASE_URL}/api/admin/analytics`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch system analytics.');
  }
  return response.json();
}


/**
 * Normalizes an output asset path returned from the server into a fully-qualified static URL
 */
export function getAssetUrl(rawPath: string | null): string {
  if (!rawPath) return '';
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    return rawPath;
  }
  // Clean up backslashes and remove leading "./" or "/"
  const cleanPath = rawPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '');
  
  // Remove trailing slash from BASE_URL to prevent double slashes
  const cleanBase = BASE_URL.replace(/\/$/, '');
  
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Uploads a text file to initiate the story conversion pipeline
 */
export async function uploadStoryFile(file: File, voice = 'en-US-JennyNeural'): Promise<{ job_id: string; status: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('voice', voice);

  const response = await fetch(`${BASE_URL}/api/analyze/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to upload story file.');
  }

  return response.json();
}

/**
 * Creates and uploads a virtual text file from raw story text
 */
export async function uploadStoryText(text: string, filename = 'story.txt', voice = 'en-US-JennyNeural'): Promise<{ job_id: string; status: string; message: string }> {
  const file = new File([text], filename, { type: 'text/plain' });
  return uploadStoryFile(file, voice);
}

/**
 * Fetches the status of a specific job
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/status/${jobId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch status for job ${jobId}`);
  }
  return response.json();
}

/**
 * Lists all historical jobs
 */
export async function listAllJobs(limit = 20): Promise<JobListResponse> {
  const response = await fetch(`${BASE_URL}/api/status/?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to list jobs.');
  }
  return response.json();
}

/**
 * Fetches download links for a completed job
 */
export async function getDownloadLinks(jobId: string): Promise<JobOutputLinks> {
  const response = await fetch(`${BASE_URL}/api/download/${jobId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch download links for job ${jobId}`);
  }
  return response.json();
}

/**
 * Re-triggers a specific stage of the pipeline for a job
 */
export async function reTriggerStep(jobId: string, step: 'images' | 'voices' | 'subtitles' | 'video' | 'metadata' | 'thumbnail'): Promise<{ job_id: string; message: string }> {
  const response = await fetch(`${BASE_URL}/api/generate/${step}/${jobId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to trigger ${step} generation.`);
  }

  return response.json();
}

/**
 * Deletes a job and its associated files
 */
export async function deleteJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_URL}/api/status/${jobId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete job ${jobId}`);
  }

  return response.json();
}

/**
 * Updates a job's details (e.g. rename the story_filename)
 */
export async function updateJob(jobId: string, payload: { story_filename?: string }): Promise<JobStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/status/${jobId}`, {
    method: 'PATCH',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update job ${jobId}`);
  }

  return response.json();
}

export interface PollenBalanceResponse {
  success: boolean;
  pollen: number | null;
  images_left: number | null;
  error?: string;
  message?: string;
}

/**
 * Fetches the Pollinations account balance and remaining images estimate
 */
export async function getPollenBalance(): Promise<PollenBalanceResponse> {
  const response = await fetch(`${BASE_URL}/api/status/pollen/balance`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch Pollen balance.');
  }
  return response.json();
}

/**
 * Update and regenerate a single scene's visual prompt or narration
 */
export async function regenerateScene(
  jobId: string,
  sceneNumber: number,
  payload: {
    image_prompt?: string;
    text?: string;
    location?: string;
    mood?: string;
    regenerate_image?: boolean;
    regenerate_voice?: boolean;
  }
): Promise<{ job_id: string; message: string }> {
  const response = await fetch(`${BASE_URL}/api/generate/scene/${jobId}/${sceneNumber}`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update and regenerate scene ${sceneNumber}`);
  }

  return response.json();
}

/**
 * Builds the URL to stream the voice sample greeting
 */
export function getVoiceSampleUrl(voiceId: string): string {
  return `${BASE_URL}/api/status/voice/sample/${voiceId}`;
}

/**
 * Pauses a running pipeline job
 */
export async function pauseJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_URL}/api/status/pause/${jobId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to pause job ${jobId}`);
  }
  return response.json();
}

/**
 * Resumes a paused pipeline job
 */
export async function resumeJob(jobId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_URL}/api/status/resume/${jobId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to resume job ${jobId}`);
  }
  return response.json();
}

/**
 * Re-triggers thumbnail generation with optional custom text and custom background scene number
 */
export async function regenerateThumbnailCustom(
  jobId: string,
  payload: { title?: string | null; scene_number?: number | null; prompt?: string | null }
): Promise<{ job_id: string; message: string }> {
  const response = await fetch(`${BASE_URL}/api/generate/thumbnail/${jobId}`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to regenerate custom thumbnail for job ${jobId}`);
  }
  return response.json();
}

/**
 * Builds the URL for direct attachment downloading of video or thumbnail
 */
export function getDownloadFileUrl(jobId: string, fileType: 'video' | 'thumbnail'): string {
  const cleanBase = BASE_URL.replace(/\/$/, '');
  return `${cleanBase}/api/download/file/${jobId}/${fileType}`;
}

/**
 * Downloads a file from the backend by performing an authenticated fetch and triggering
 * the download client-side via a temporary Blob Object URL.
 */
export async function downloadFileWithAuth(jobId: string, fileType: 'video' | 'thumbnail', defaultFilename: string): Promise<void> {
  const url = getDownloadFileUrl(jobId, fileType);
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to download file.');
  }
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export interface PollenRequest {
  id: string;
  user_id: string;
  amount: number;
  message: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  reviewed_at: string | null;
  username?: string;
}

/**
 * Updates profile fields for the logged in user
 */
export async function updateProfile(payload: {
  full_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  dob?: string;
  avatar_data?: string;
}): Promise<UserResponse> {
  const response = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to update profile.');
  }
  return response.json();
}

/**
 * Changes current user's password
 */
export async function changePassword(payload: {
  old_password: string;
  new_password: string;
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to change password.');
  }
  return response.json();
}

/**
 * Sends a lightweight heartbeat ping to update last_seen activity
 */
export async function sendHeartbeat(): Promise<{ success: boolean; active: boolean }> {
  const response = await fetch(`${BASE_URL}/api/auth/heartbeat`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to send heartbeat.');
  }
  return response.json();
}

/**
 * Submits a new pollen credit request
 */
export async function requestPollenCredits(amount: number, message: string): Promise<{ success: boolean; request: PollenRequest }> {
  const response = await fetch(`${BASE_URL}/api/status/pollen/request`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ amount, message }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to submit pollen request.');
  }
  return response.json();
}

/**
 * Retrieves pollen credit requests for the logged in user
 */
export async function getUserPollenRequests(): Promise<{ success: boolean; requests: PollenRequest[] }> {
  const response = await fetch(`${BASE_URL}/api/status/pollen/requests`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch pollen requests.');
  }
  return response.json();
}

/**
 * Retrieves all pollen requests in the system (Admin only)
 */
export async function getAllPollenRequests(): Promise<{ success: boolean; requests: PollenRequest[] }> {
  const response = await fetch(`${BASE_URL}/api/admin/pollen/requests`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch all pollen requests.');
  }
  return response.json();
}

/**
 * Approves or denies a pollen request (Admin only)
 */
export async function reviewPollenRequest(requestId: string, status: 'approved' | 'denied'): Promise<{ success: boolean; status: string }> {
  const response = await fetch(`${BASE_URL}/api/admin/pollen/requests/${requestId}/review`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to review pollen request.');
  }
  return response.json();
}

/**
 * Direct override of user pollen credits balance (Admin only)
 */
export async function editUserPollenCredits(userId: string, amount: number): Promise<{ success: boolean; pollen_balance: number }> {
  const response = await fetch(`${BASE_URL}/api/admin/users/${userId}/pollen`, {
    method: 'PATCH',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to edit user pollen balance.');
  }
  return response.json();
}

/**
 * Toggles user active/deactive status (Admin only)
 */
export async function toggleUserActive(userId: string): Promise<{ success: boolean; is_active: boolean }> {
  const response = await fetch(`${BASE_URL}/api/admin/users/${userId}/toggle-active`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to toggle user status.');
  }
  return response.json();
}

/**
 * Fetches all jobs owned by a specific user (Admin only)
 */
export async function getUserJobs(userId: string): Promise<JobSummary[]> {
  const response = await fetch(`${BASE_URL}/api/admin/users/${userId}/jobs`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch user jobs.');
  }
  return response.json();
}

export interface AdminServerStatusResponse {
  success: boolean;
  status: {
    id: string;
    status: 'online' | 'offline';
    tunnel_url: string | null;
    last_ping: string;
    max_concurrent_tasks: number;
    max_concurrent_users: number;
    active_tasks: number;
    active_users: number;
    cpu_usage: number;
    ram_usage: number;
  };
  wake_requests: Array<{
    id: string;
    status: 'pending' | 'accepted' | 'ignored';
    message: string | null;
    created_at: string;
  }>;
}

/**
 * Fetches current live server status, resource usage, and pending wake requests (Admin only)
 */
export async function fetchServerStatus(): Promise<AdminServerStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/admin/server-status`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to fetch live server status.');
  }
  return response.json();
}

/**
 * Updates backend configuration settings (Admin only)
 */
export async function updateServerSettings(maxTasks: number, maxUsers: number): Promise<{ success: boolean }> {
  const response = await fetch(`${BASE_URL}/api/admin/server-settings`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      max_concurrent_tasks: maxTasks,
      max_concurrent_users: maxUsers
    }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to update server settings.');
  }
  return response.json();
}

/**
 * Approves or ignores a wake request from the admin console (Admin only)
 */
export async function reviewWakeRequest(requestId: string, status: 'accepted' | 'ignored'): Promise<{ success: boolean; reviewed: boolean }> {
  const response = await fetch(`${BASE_URL}/api/admin/wake-requests/${requestId}/review`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to review wake request.');
  }
  return response.json();
}

/**
 * Updates a user's role (Admin only, promote to admin requires main admin varun5367)
 */
export async function editUserRole(userId: string, role: string): Promise<{ success: boolean; role: string }> {
  const response = await fetch(`${BASE_URL}/api/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || 'Failed to update user role.');
  }
  return response.json();
}


