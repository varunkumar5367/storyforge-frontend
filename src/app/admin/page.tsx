// src/app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchAdminUsers,
  deleteAdminUser,
  fetchAdminLogs,
  deleteJob,
  JobSummary,
  UserResponse,
  getUserJobs,
  editUserPollenCredits,
  toggleUserActive,
  getAllPollenRequests,
  reviewPollenRequest,
  PollenRequest,
  fetchAdminAnalytics,
  SystemAnalytics,
  fetchServerStatus,
  updateServerSettings,
  reviewWakeRequest,
  editUserRole
} from '@/utils/api';

// ── Toast types ──────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' };
type ConfirmState = { message: string; onConfirm: () => void } | null;

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'analytics' | 'server'>('users');
  const [username, setUsername] = useState<string | null>(null);

  // ── Toast & Confirm system ─────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const toastCounter = useRef(0);

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const showConfirm = (message: string): Promise<boolean> =>
    new Promise(resolve => {
      setConfirmState({
        message,
        onConfirm: () => { setConfirmState(null); resolve(true); },
      });
    });

  const handleConfirmCancel = () => {
    setConfirmState(null);
  };
  
  // Data states
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [allRequests, setAllRequests] = useState<PollenRequest[]>([]);
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [serverStatus, setServerStatus] = useState<any | null>(null);
  const [maxTasksInput, setMaxTasksInput] = useState<number>(1);
  const [maxUsersInput, setMaxUsersInput] = useState<number>(5);

  // CPU/RAM sparkline history (last 20 readings)
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  
  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  
  // Real-time activity timer
  const [now, setNow] = useState<Date>(new Date());

  // Expandable User panel state
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedUserJobs, setExpandedUserJobs] = useState<JobSummary[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [editPollenVal, setEditPollenVal] = useState<string>('');
  const [expandedFailureIds, setExpandedFailureIds] = useState<string[]>([]);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  // Mobile layout detector
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Authenticate user as admin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('storyforge_token');
      const role = localStorage.getItem('storyforge_role');
      const uname = localStorage.getItem('storyforge_username');
      setUsername(uname);
      if (!token) {
        router.push('/login');
      } else if (role !== 'admin') {
        router.push('/');
      } else {
        setAuthorized(true);
      }
    }
  }, [router]);

  // Dynamic clock for Online/Offline threshold checks
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial data
  const loadData = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setError(null);
    try {
      const [usersData, logsData, requestsData, analyticsData, serverStatusData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminLogs().catch(() => ({ success: true, logs: ['[Logs not available or empty]'] })),
        getAllPollenRequests().catch(() => ({ success: true, requests: [] })),
        fetchAdminAnalytics().catch(() => null),
        fetchServerStatus().catch(() => null)
      ]);
      setUsers(usersData);
      setLogs(logsData.logs || []);
      setAllRequests(requestsData.requests || []);
      setAnalytics(analyticsData);
      if (serverStatusData && serverStatusData.success) {
        setServerStatus(serverStatusData);
        setMaxTasksInput(serverStatusData.status.max_concurrent_tasks);
        setMaxUsersInput(serverStatusData.status.max_concurrent_users);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load admin dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Scroll to bottom of logs when log tab opens or logs refresh
  useEffect(() => {
    if (activeTab === 'logs' && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Periodic poll of logs when admin is active
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(async () => {
      try {
        if (activeTab === 'logs') {
          const logsData = await fetchAdminLogs();
          setLogs(logsData.logs || []);
        } else if (activeTab === 'analytics') {
          const analyticsData = await fetchAdminAnalytics().catch(() => null);
          setAnalytics(analyticsData);
        } else if (activeTab === 'server') {
          const serverStatusData = await fetchServerStatus().catch(() => null);
          if (serverStatusData && serverStatusData.success) {
            setServerStatus(serverStatusData);
            // Append to sparkline history
            setCpuHistory(prev => [...prev.slice(-19), serverStatusData.status?.cpu_usage ?? 0]);
            setRamHistory(prev => [...prev.slice(-19), serverStatusData.status?.ram_usage ?? 0]);
          }
        }
        
        // Quietly refresh users to catch activity heartbeat updates
        const usersData = await fetchAdminUsers();
        setUsers(usersData);
      } catch (err) {
        console.warn('Silent admin refresh failed:', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [authorized, activeTab]);


  const handleDeleteUser = async (userId: string, username: string) => {
    const ok = await showConfirm(`Delete user "${username}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteAdminUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      if (expandedUserId === userId) setExpandedUserId(null);
      showToast(`User "${username}" deleted.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user.', 'error');
    }
  };

  const handleToggleUserStatus = async (userId: string, username: string) => {
    const action = users.find(u => u.id === userId)?.is_active ? 'deactivate' : 'activate';
    const ok = await showConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user "${username}"?`);
    if (!ok) return;
    try {
      const res = await toggleUserActive(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: res.is_active } : u));
      showToast(`User "${username}" ${action}d.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle user status.', 'error');
    }
  };

  const handleToggleUserRole = async (userId: string, username: string, currentRole: string) => {
    const targetRole = currentRole === 'admin' ? 'user' : 'admin';
    const actionWord = targetRole === 'admin' ? 'promote to admin' : 'demote to user';
    const ok = await showConfirm(`${actionWord.charAt(0).toUpperCase() + actionWord.slice(1)} "${username}"?`);
    if (!ok) return;
    try {
      const res = await editUserRole(userId, targetRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: res.role } : u));
      showToast(`"${username}" is now ${res.role}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle user role.', 'error');
    }
  };

  const handleExpandUser = async (user: UserResponse) => {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(user.id);
    setEditPollenVal(user.pollen_balance?.toString() || '20.0000');
    setJobsLoading(true);
    setExpandedUserJobs([]);
    try {
      const jobsData = await getUserJobs(user.id);
      setExpandedUserJobs(jobsData);
    } catch (err) {
      console.warn("Failed to load user jobs:", err);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleSavePollenLimit = async (userId: string) => {
    const amt = parseFloat(editPollenVal);
    if (isNaN(amt) || amt < 0) {
      showToast('Please enter a valid positive decimal value.', 'error');
      return;
    }
    try {
      await editUserPollenCredits(userId, amt);
      setUsers(users.map(u => u.id === userId ? { ...u, pollen_balance: amt } : u));
      showToast('Choco balance updated successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update balance.', 'error');
    }
  };

  const handleReviewPollenRequest = async (requestId: string, status: 'approved' | 'denied') => {
    try {
      await reviewPollenRequest(requestId, status);
      setAllRequests(allRequests.map(r => r.id === requestId ? { ...r, status } : r));
      if (status === 'approved') {
        const reqObj = allRequests.find(r => r.id === requestId);
        if (reqObj) {
          setUsers(users.map(u => u.id === reqObj.user_id ? { ...u, pollen_balance: (u.pollen_balance ?? 20.0) + reqObj.amount } : u));
          if (expandedUserId === reqObj.user_id) {
            setEditPollenVal(((users.find(u => u.id === reqObj.user_id)?.pollen_balance ?? 20.0) + reqObj.amount).toString());
          }
        }
        showToast('Credit request approved ✓', 'success');
      } else {
        showToast('Credit request denied.', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to review credit request.', 'error');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const ok = await showConfirm(`Delete job "${jobId}" and all its output files?`);
    if (!ok) return;
    try {
      await deleteJob(jobId);
      setExpandedUserJobs(expandedUserJobs.filter(j => j.job_id !== jobId));
      showToast('Job deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete job.', 'error');
    }
  };

  const handleRefreshLogs = async () => {
    setRefreshingLogs(true);
    try {
      const logsData = await fetchAdminLogs();
      setLogs(logsData.logs || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setRefreshingLogs(false);
    }
  };

  const toggleFailureExpand = (id: string) => {
    if (expandedFailureIds.includes(id)) {
      setExpandedFailureIds(expandedFailureIds.filter(x => x !== id));
    } else {
      setExpandedFailureIds([...expandedFailureIds, id]);
    }
  };

  const isOnline = (lastSeenStr?: string) => {
    if (!lastSeenStr) return false;
    try {
      const lastSeen = new Date(lastSeenStr);
      const diffMs = now.getTime() - lastSeen.getTime();
      return diffMs < 40000; // active in the last 40 seconds
    } catch {
      return false;
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-green)', border: '1px solid rgba(16, 185, 129, 0.2)' };
      case 'failed':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'pending':
        return { backgroundColor: 'rgba(113, 113, 122, 0.1)', color: 'var(--text-muted)', border: '1px solid rgba(113, 113, 122, 0.2)' };
      default:
        return { backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(139, 92, 246, 0.2)' };
    }
  };

  if (!authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Authenticating admin status...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '40px max(4vw, 24px)', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, letterSpacing: '-0.75px', color: 'var(--text-primary)', marginBottom: '8px' }}>
            System Admin Console
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Manage platform users, inspect pipeline tasks, and monitor raw system logs.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--border-radius)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition-fast)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
        >
          <svg className={loading ? 'animate-spin-fast' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh Console
        </button>
      </div>

      {error && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 'var(--border-radius-lg)',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          color: 'var(--accent-red)',
          marginBottom: '32px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Tabs bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '32px',
        gap: '24px'
      }}>
        {(['users', 'logs', 'analytics', 'server'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-purple)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '16px',
              textTransform: 'capitalize',
              transition: 'var(--transition-fast)',
              outline: 'none',
            }}
          >
            {tab === 'users' ? 'User Accounts' : tab === 'logs' ? 'System Logs' : tab === 'analytics' ? 'System Analytics' : 'Server Control'}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <svg className="animate-spin-fast" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '15px' }}>Loading console details...</p>
        </div>
      )}

      {!loading && activeTab === 'users' && (
        <div className="glass" style={{
          borderRadius: 'var(--border-radius-lg)',
          border: '1px solid var(--border-color)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <table style={{ width: '100%', minWidth: isMobile ? '800px' : '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '15px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>User Accounts</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Activity Status</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const userOnline = isOnline(user.last_seen);
                const userRequests = allRequests.filter(r => r.user_id === user.id);
                const pendingRequests = userRequests.filter(r => r.status === 'pending');
                const isExpanded = expandedUserId === user.id;

                return (
                  <React.Fragment key={user.id}>
                    {/* User Row */}
                    <tr 
                      onClick={() => handleExpandUser(user)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        transition: 'var(--transition-fast)',
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? 'rgba(139, 92, 246, 0.04)' : 'transparent'
                      }}
                      className="glass-interactive"
                    >
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-purple)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '15px',
                            overflow: 'hidden'
                          }}>
                            {user.avatar_data ? (
                              <img src={user.avatar_data} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              (user.display_name || user.username).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {user.display_name || user.username}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {user.id}
                            </div>
                          </div>
                          {pendingRequests.length > 0 && (
                            <span style={{
                              backgroundColor: 'var(--accent-orange)',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '10px',
                              marginLeft: '8px'
                            }}>
                              {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: user.role === 'admin' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: user.role === 'admin' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                          border: user.role === 'admin' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)'
                        }}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: userOnline ? 'var(--accent-green)' : 'var(--text-muted)'
                          }} />
                          <span style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: userOnline ? 'var(--accent-green)' : 'var(--text-secondary)'
                          }}>
                            {userOnline ? 'Active (Online)' : 'Offline'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '18px 24px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* Promote/Demote to/from Admin (Only the main admin varun5367 can do this, and cannot change themselves) */}
                          {username === 'varun5367' && user.username !== 'varun5367' && (
                            <button
                              onClick={() => handleToggleUserRole(user.id, user.username, user.role)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: user.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                                border: user.role === 'admin' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                                color: user.role === 'admin' ? 'var(--accent-red)' : 'var(--accent-purple)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                transition: 'var(--transition-fast)'
                              }}
                            >
                              {user.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>
                          )}

                          {user.username !== 'varun5367' ? (
                            <>
                              <button
                                onClick={() => handleToggleUserStatus(user.id, user.username)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: user.is_active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  border: user.is_active ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                                  color: user.is_active ? 'var(--accent-red)' : 'var(--accent-green)',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  transition: 'var(--transition-fast)'
                                }}
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: 'var(--accent-red)',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  transition: 'var(--transition-fast)'
                                }}
                              >
                                Delete User
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>Main Admin (Protected)</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Collapsible Details Panel */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <td colSpan={4} style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            
                            {/* Top info and Credit Editor */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'space-between' }}>
                              {/* Metadata list */}
                              <div style={{ flex: '1 1 300px' }}>
                                <h4 style={{ margin: '0 0 12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                  User Account Information
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '14px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                                  <span style={{ fontWeight: 500 }}>{user.full_name || '—'}</span>
                                  
                                  <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                                  <span style={{ fontWeight: 500 }}>{user.email || '—'}</span>
                                  
                                  <span style={{ color: 'var(--text-secondary)' }}>Contact Info:</span>
                                  <span style={{ fontWeight: 500 }}>{user.phone || '—'}</span>
                                  
                                  <span style={{ color: 'var(--text-secondary)' }}>DOB:</span>
                                  <span style={{ fontWeight: 500 }}>{user.dob || '—'}</span>

                                  <span style={{ color: 'var(--text-secondary)' }}>Account Status:</span>
                                  <span style={{ fontWeight: 600, color: user.is_active ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                    {user.is_active ? 'Active' : 'Inactive / Blocked'}
                                  </span>
                                </div>
                              </div>

                              {/* Edit Choco Credits */}
                              <div className="glass" style={{ flex: '1 1 350px', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                  Choco Quota Limit
                                </h4>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                                  Override the hourly image generation budget for this user account.
                                </p>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={editPollenVal}
                                      onChange={(e) => setEditPollenVal(e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 'var(--border-radius)',
                                        border: '1px solid var(--border-color)',
                                        background: 'rgba(0,0,0,0.2)',
                                        color: '#ffffff',
                                        fontSize: '14px',
                                        fontWeight: 600
                                      }}
                                      placeholder="20.0000"
                                    />
                                    <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                      Credits
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleSavePollenLimit(user.id)}
                                    style={{
                                      padding: '10px 16px',
                                      borderRadius: 'var(--border-radius)',
                                      backgroundColor: 'var(--accent-purple)',
                                      color: '#ffffff',
                                      border: 'none',
                                      fontWeight: 600,
                                      fontSize: '13px',
                                      cursor: 'pointer',
                                      transition: 'var(--transition-fast)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                                    onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1.0)'}
                                  >
                                    Save Limit
                                  </button>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                  Current Limit: <strong style={{ color: 'var(--accent-purple)' }}>{Math.round(user.pollen_balance ?? 20.0)} Choco</strong>
                                </div>
                              </div>
                            </div>

                            {/* Choco Requests List */}
                            {userRequests.length > 0 && (
                              <div>
                                <h4 style={{ margin: '0 0 12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                  Pollen Credit Requests
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {userRequests.map((req) => (
                                    <div key={req.id} className="glass" style={{
                                      padding: '12px 16px',
                                      borderRadius: '8px',
                                      border: '1px solid var(--border-color)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      backgroundColor: req.status === 'pending' ? 'rgba(245, 158, 11, 0.03)' : 'transparent'
                                    }}>
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span style={{ fontWeight: 700, color: 'var(--accent-orange)', fontSize: '15px' }}>
                                            +{req.amount.toFixed(4)} Credits
                                          </span>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: req.status === 'pending' ? 'rgba(245,158,11,0.15)' : req.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: req.status === 'pending' ? 'var(--accent-orange)' : req.status === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)',
                                          }}>
                                            {req.status}
                                          </span>
                                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {new Date(req.created_at).toLocaleDateString()}
                                          </span>
                                        </div>
                                        {req.message && (
                                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            &ldquo;{req.message}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                      
                                      {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button
                                            onClick={() => handleReviewPollenRequest(req.id, 'approved')}
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: '4px',
                                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                              border: '1px solid rgba(16, 185, 129, 0.2)',
                                              color: 'var(--accent-green)',
                                              fontWeight: 600,
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              transition: 'var(--transition-fast)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => handleReviewPollenRequest(req.id, 'denied')}
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: '4px',
                                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                              border: '1px solid rgba(239, 68, 68, 0.2)',
                                              color: 'var(--accent-red)',
                                              fontWeight: 600,
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              transition: 'var(--transition-fast)'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                                          >
                                            Deny
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* User Jobs List */}
                            <div>
                              <h4 style={{ margin: '0 0 12px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                Pipeline Generation Jobs ({expandedUserJobs.length})
                              </h4>
                              
                              {jobsLoading ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Loading user jobs...</p>
                              ) : expandedUserJobs.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                                  No jobs currently registered in the queue for this user.
                                </p>
                              ) : (
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                  <table style={{ width: '100%', minWidth: isMobile ? '600px' : '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Job ID</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Story Filename</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Progress</th>
                                        <th style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedUserJobs.map((job) => (
                                        <tr key={job.job_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                                            <a href={`/studio?job_id=${job.job_id}`} style={{ color: 'var(--accent-purple)', fontWeight: 600, textDecoration: 'none' }}>
                                              {job.job_id.slice(0, 8)}...
                                            </a>
                                          </td>
                                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{job.story_filename || 'story.txt'}</td>
                                          <td style={{ padding: '12px 16px' }}>
                                            <span style={{
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              textTransform: 'uppercase',
                                              ...getBadgeClass(job.status)
                                            }}>
                                              {job.status.replace('generating_', 'gen ').replace('_', ' ')}
                                            </span>
                                          </td>
                                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{job.progress_percent}%</td>
                                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            {job.status === 'completed' && (
                                              <button
                                                onClick={() => router.push(`/accuracy?job_id=${job.job_id}`)}
                                                style={{
                                                  padding: '4px 8px',
                                                  borderRadius: '4px',
                                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                                  color: 'var(--accent-green)',
                                                  cursor: 'pointer',
                                                  fontSize: '11px',
                                                  fontWeight: 600,
                                                  transition: 'var(--transition-fast)',
                                                  marginRight: '8px'
                                                }}
                                              >
                                                📊 Accuracy Report
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleDeleteJob(job.job_id)}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                color: 'var(--accent-red)',
                                                cursor: 'pointer',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                transition: 'var(--transition-fast)'
                                              }}
                                            >
                                              Purge Job
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No registered user accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Showing latest backend console stdout logs. Automatically refreshes every 10 seconds.
            </span>
            <button
              onClick={handleRefreshLogs}
              disabled={refreshingLogs}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg className={refreshingLogs ? 'animate-spin-fast' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh Logs
            </button>
          </div>

          <div style={{
            backgroundColor: '#050508',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '24px',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#a3e635', // nice hacker-green terminal color
            overflowY: 'auto',
            maxHeight: '600px',
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8)'
          }}>
            {logs.map((logLine, idx) => (
              <div key={idx} style={{
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                paddingBottom: '4px',
                marginBottom: '4px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap'
              }}>
                {logLine}
              </div>
            ))}
            {logs.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                System logs are currently empty.
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {!loading && activeTab === 'analytics' && (
        <div>
          {!analytics ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No analytics data available. Ensure the backend server is online and database tables are populated.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* 1. KPI Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                {/* Render Stats Card */}
                <div className="glass" style={{ padding: '20px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>Video Renders</h3>
                    <span style={{ fontSize: '24px' }}>🎬</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Completed:</span>
                      <strong style={{ color: 'var(--accent-green)' }}>{analytics.renders.completed}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Failed:</span>
                      <strong style={{ color: 'var(--accent-red)' }}>{analytics.renders.failed}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avg. Duration:</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.renders.avg_duration}s</strong>
                    </div>
                  </div>
                </div>

                {/* Memory Load Card */}
                <div className="glass" style={{ padding: '20px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>Memory Load</h3>
                    <span style={{ fontSize: '24px' }}>💾</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Peak Memory:</span>
                      <strong style={{ color: 'var(--accent-purple)' }}>{analytics.renders.max_memory} MB</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avg. Memory:</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.renders.avg_memory} MB</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Server Platform:</span>
                      <strong style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>Linux (Render)</strong>
                    </div>
                  </div>
                </div>

                {/* User Activity & Conversion Card */}
                <div className="glass" style={{ padding: '20px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>User Engagement</h3>
                    <span style={{ fontSize: '24px' }}>👥</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Conversion Rate:</span>
                      <strong style={{ color: 'var(--accent-orange)' }}>{analytics.users.conversion_rate}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Active (24h / 30d):</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.users.active_24h} / {analytics.users.active_30d}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Registered:</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.users.total_registered} users</strong>
                    </div>
                  </div>
                </div>

                {/* Credit Consumption Card */}
                <div className="glass" style={{ padding: '20px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>Choco Credits</h3>
                    <span style={{ fontSize: '24px' }}>🪙</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Consumed:</span>
                      <strong style={{ color: 'var(--accent-purple)' }}>{analytics.credits.total_consumed.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Held (Users):</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.credits.total_held.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Req (Appr / Deny):</span>
                      <strong style={{ color: '#ffffff' }}>{analytics.credits.total_requested.toFixed(0)} ({analytics.credits.total_approved.toFixed(0)} / {analytics.credits.total_denied.toFixed(0)})</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Middle Columns (Durations Breakdown & Credit Users / Recent Renders) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.2fr',
                gap: '32px'
              }}>
                {/* Left Side: Step Durations & Credit Consumers */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {/* Step Durations Breakdown */}
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Average Step Duration Breakdown
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {Object.entries(analytics.renders.avg_steps).map(([step, val]) => {
                        const stepNames: Record<string, string> = {
                          analyzing: 'Story Analysis',
                          generating_images: 'Image Generation',
                          generating_voice: 'Voice Narration',
                          generating_subtitles: 'Subtitle Transcription',
                          composing_video: 'FFmpeg Video Composition',
                          generating_metadata: 'YouTube Metadata Gen',
                          generating_thumbnail: 'Thumbnail Creation'
                        };
                        const totalAvg = Object.values(analytics.renders.avg_steps).reduce((a, b) => a + b, 0) || 1.0;
                        const pct = Math.min(100, Math.round((val / totalAvg) * 100));

                        return (
                          <div key={step} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stepNames[step] || step}</span>
                              <strong style={{ color: '#ffffff' }}>{val.toFixed(2)}s ({pct}%)</strong>
                            </div>
                            <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct}%`,
                                height: '100%',
                                borderRadius: '3px',
                                backgroundColor: step === 'composing_video' ? 'var(--accent-purple)' : 'rgba(139, 92, 246, 0.55)',
                                transition: 'width 0.8s ease-out'
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Credit Consumers */}
                  <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Top Credit Consumers
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {analytics.credits.by_user.map((u, idx) => (
                        <div key={u.username} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.03)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: idx === 0 ? 'var(--accent-purple)' : 'rgba(255,255,255,0.05)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700
                            }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.username}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--accent-orange)' }}>
                            {u.consumed.toFixed(1)} Credits
                          </span>
                        </div>
                      ))}
                      {analytics.credits.by_user.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: 0 }}>No credits consumed yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Recent Render Runs */}
                <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Recent Render Runs (Last 10)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Job ID</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>User</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Memory</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.renders.recent.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 12px', fontFamily: 'monospace' }}>
                              <a href={`/studio?job_id=${r.job_id}`} style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontWeight: 600 }}>
                                {r.job_id.slice(0, 8)}...
                              </a>
                            </td>
                            <td style={{ padding: '12px 12px', color: 'var(--text-primary)' }}>{r.username || '—'}</td>
                            <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{r.total_duration.toFixed(1)}s</td>
                            <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{r.peak_memory_mb > 0 ? `${r.peak_memory_mb.toFixed(0)}MB` : '—'}</td>
                            <td style={{ padding: '12px 12px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                ...getBadgeClass(r.status)
                              }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                              {r.status === 'completed' && (
                                <a
                                  href={`/accuracy?job_id=${r.job_id}`}
                                  style={{
                                    color: 'var(--accent-green)',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    fontSize: '12px'
                                  }}
                                >
                                  📊 Report
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                        {analytics.renders.recent.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No render runs recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 3. FFmpeg Failures & Error Logs */}
              <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  FFmpeg Failure Analytics & Diagnostics
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px' }}>
                  Review failures, failed commands, and tail logs to resolve issues like OOMs, codec incompatibilities, or bad assets.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {analytics.failures.map((f) => {
                    const isExpanded = expandedFailureIds.includes(f.id);
                    return (
                      <div key={f.id} style={{
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(239, 68, 68, 0.02)',
                        overflow: 'hidden'
                      }}>
                        <div 
                          onClick={() => toggleFailureExpand(f.id)}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(239, 68, 68, 0.03)',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
                            <span style={{
                              color: 'var(--accent-red)',
                              fontWeight: 700,
                              fontSize: '13px',
                              backgroundColor: 'rgba(239,68,68,0.15)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              Exit -9 / OOM / Fail
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              Job: <span style={{ fontFamily: 'monospace' }}>{f.job_id}</span>
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              User: <strong>{f.username || '—'}</strong>
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {new Date(f.created_at).toLocaleString()}
                            </span>
                          </div>
                          <span style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            fontSize: '14px',
                            color: 'var(--text-secondary)'
                          }}>
                            ▼
                          </span>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                                Error Message
                              </strong>
                              <p style={{
                                margin: 0,
                                fontSize: '14px',
                                color: '#ffffff',
                                whiteSpace: 'pre-wrap',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.05)'
                              }}>
                                {f.error_message}
                              </p>
                            </div>

                            {f.ffmpeg_cmd && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <strong style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                    FFmpeg Command executed
                                  </strong>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(f.ffmpeg_cmd || '');
                                      showToast('Command copied to clipboard!', 'success');
                                    }}
                                    style={{
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(255,255,255,0.05)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Copy Command
                                  </button>
                                </div>
                                <code style={{
                                  display: 'block',
                                  fontSize: '12px',
                                  color: 'var(--accent-purple)',
                                  backgroundColor: '#050508',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  overflowX: 'auto',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-all',
                                  fontFamily: 'monospace'
                                }}>
                                  {f.ffmpeg_cmd}
                                </code>
                              </div>
                            )}

                            {f.ffmpeg_stderr && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <strong style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                    FFmpeg Stderr tail log
                                  </strong>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(f.ffmpeg_stderr || '');
                                      showToast('Stderr log copied to clipboard!', 'success');
                                    }}
                                    style={{
                                      padding: '2px 8px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(255,255,255,0.05)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Copy Stderr
                                  </button>
                                </div>
                                <pre style={{
                                  margin: 0,
                                  fontSize: '12px',
                                  color: '#f87171',
                                  backgroundColor: '#070202',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.1)',
                                  overflowX: 'auto',
                                  maxHeight: '300px',
                                  overflowY: 'auto',
                                  fontFamily: 'monospace',
                                  whiteSpace: 'pre-wrap'
                                }}>
                                  {f.ffmpeg_stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {analytics.failures.length === 0 && (
                    <div style={{
                      padding: '32px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '14px',
                      fontStyle: 'italic'
                    }}>
                      🎉 Huzzah! No FFmpeg errors or rendering failures recorded in the database.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'server' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Status and Resources Gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '32px' }}>
            <div className="glass" style={{ padding: '32px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: serverStatus?.status?.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)',
                  display: 'inline-block',
                  boxShadow: serverStatus?.status?.status === 'online' ? '0 0 10px var(--accent-green)' : 'none'
                }} />
                Backend Service: {serverStatus?.status?.status === 'online' ? 'Online' : 'Offline'}
              </h3>
              
              {serverStatus?.status?.status === 'online' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tunnel URL (trycloudflare)</span>
                    <div style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      padding: '12px',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      color: 'var(--accent-purple)',
                      wordBreak: 'break-all',
                      marginTop: '4px'
                    }}>
                      {serverStatus.status.tunnel_url || 'Not set'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Last Ping Heartbeat</span>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px' }}>
                      {serverStatus.status.last_ping ? new Date(serverStatus.status.last_ping).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              )}

              {/* Resource Gauges */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '24px' }}>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>CPU Usage</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {serverStatus?.status?.cpu_usage !== undefined ? `${serverStatus.status.cpu_usage.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: `${serverStatus?.status?.cpu_usage || 0}%`, height: '100%', background: 'var(--accent-purple)', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>RAM Usage</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {serverStatus?.status?.ram_usage !== undefined ? `${serverStatus.status.ram_usage.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: `${serverStatus?.status?.ram_usage || 0}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Pipeline Tasks</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {serverStatus?.status?.active_tasks !== undefined ? `${serverStatus.status.active_tasks} / ${serverStatus.status.max_concurrent_tasks}` : '—'}
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, ((serverStatus?.status?.active_tasks || 0) / (serverStatus?.status?.max_concurrent_tasks || 1)) * 100)}%`, height: '100%', background: 'var(--accent-green)', borderRadius: '3px' }} />
                  </div>
                </div>
              </div>

              {/* CPU/RAM sparkline history chart */}
              {(cpuHistory.length > 1 || ramHistory.length > 1) && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    📈 Live Resource History (last {Math.max(cpuHistory.length, ramHistory.length)} readings · updates every 10s)
                  </div>
                  <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none" style={{ display: 'block' }}>
                    {/* CPU Line */}
                    {cpuHistory.length > 1 && (
                      <polyline
                        points={cpuHistory.map((v, i) =>
                          `${(i / (Math.max(cpuHistory.length, 1) - 1)) * 200},${60 - (v / 100) * 55}`
                        ).join(' ')}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                    {/* RAM Line */}
                    {ramHistory.length > 1 && (
                      <polyline
                        points={ramHistory.map((v, i) =>
                          `${(i / (Math.max(ramHistory.length, 1) - 1)) * 200},${60 - (v / 100) * 55}`
                        ).join(' ')}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>■ CPU</span>
                    <span style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 600 }}>■ RAM</span>
                  </div>
                </div>
              )}
            </div>

            {/* Config Settings Panel */}
            <div className="glass" style={{ padding: '32px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>Server Limits</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Max Concurrent Tasks: {maxTasksInput}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={maxTasksInput}
                    onChange={(e) => setMaxTasksInput(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Max Concurrent Users: {maxUsersInput}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={maxUsersInput}
                    onChange={(e) => setMaxUsersInput(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                  />
                </div>

                <button
                  onClick={async () => {
                    try {
                      await updateServerSettings(maxTasksInput, maxUsersInput);
                      showToast('Server settings saved successfully.', 'success');
                      const updated = await fetchServerStatus();
                      setServerStatus(updated);
                    } catch (err: any) {
                      showToast(err.message || 'Failed to update server settings.', 'error');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--gradient-primary)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: 'var(--glow-purple)',
                    marginTop: '8px'
                  }}
                >
                  Save Settings Limits
                </button>
              </div>
            </div>
          </div>

          {/* Pending Wake Requests */}
          <div className="glass" style={{ padding: '32px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              Pending Wake Requests
            </h3>
            
            {(!serverStatus?.wake_requests || serverStatus.wake_requests.filter((r: any) => r.status === 'pending').length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No pending wake requests in the queue.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {serverStatus.wake_requests.filter((r: any) => r.status === 'pending').map((req: any) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '16px 24px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: '16px'
                    }}
                  >
                    <div style={{ alignSelf: 'flex-start' }}>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        Received: {new Date(req.created_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '4px', fontWeight: 500 }}>
                        Message: "{req.message || 'No message provided.'}"
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignSelf: isMobile ? 'flex-end' : 'center' }}>
                      <button
                        onClick={async () => {
                          const ok = await showConfirm('Ignore this wake request?');
                          if (!ok) return;
                          try {
                            await reviewWakeRequest(req.id, 'ignored');
                            showToast('Wake request ignored.', 'info');
                            const updated = await fetchServerStatus();
                            setServerStatus(updated);
                          } catch (err: any) {
                            showToast(err.message || 'Failed to review request.', 'error');
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px'
                        }}
                      >
                        Ignore
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await reviewWakeRequest(req.id, 'accepted');
                            showToast('Wake request approved! Start uvicorn + Cloudflare tunnel on your laptop.', 'success');
                            const updated = await fetchServerStatus();
                            setServerStatus(updated);
                          } catch (err: any) {
                            showToast(err.message || 'Failed to approve request.', 'error');
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'var(--accent-purple)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '13px',
                          boxShadow: 'var(--glow-purple)'
                        }}
                      >
                        Accept & Start
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast Notifications ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 18px',
            borderRadius: '10px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            border: `1px solid ${
              t.type === 'success' ? 'rgba(16,185,129,0.35)'
              : t.type === 'error'   ? 'rgba(239,68,68,0.35)'
              : 'rgba(139,92,246,0.35)'
            }`,
            background: t.type === 'success' ? 'rgba(16,185,129,0.12)'
              : t.type === 'error' ? 'rgba(239,68,68,0.12)'
              : 'rgba(139,92,246,0.12)',
            color: t.type === 'success' ? 'var(--accent-green)'
              : t.type === 'error' ? 'var(--accent-red)'
              : 'var(--accent-purple)',
            fontWeight: 600,
            fontSize: '14px',
            minWidth: '260px',
            maxWidth: '400px',
            animation: 'slideInRight 0.25s ease',
          }}>
            <span style={{ fontSize: '18px' }}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{t.message}</span>
            <span
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ cursor: 'pointer', opacity: 0.5, fontSize: '16px', lineHeight: 1 }}
            >×</span>
          </div>
        ))}
      </div>

      {/* ── Confirm Dialog ──────────────────────────────────────────────── */}
      {confirmState && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="glass" style={{
            padding: '32px 28px', borderRadius: '16px',
            border: '1px solid var(--border-color)',
            maxWidth: '420px', width: '90%',
            display: 'flex', flexDirection: 'column', gap: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <span style={{ fontSize: '26px', lineHeight: 1 }}>⚠️</span>
              <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {confirmState.message}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleConfirmCancel}
                style={{
                  padding: '9px 20px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontWeight: 600,
                  fontSize: '14px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                style={{
                  padding: '9px 20px', borderRadius: '8px',
                  background: 'var(--accent-red)',
                  border: 'none', color: '#fff',
                  fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
