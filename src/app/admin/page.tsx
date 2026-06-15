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
  PollenRequest
} from '@/utils/api';

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  
  // Data states
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [allRequests, setAllRequests] = useState<PollenRequest[]>([]);
  
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
      const [usersData, logsData, requestsData] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminLogs().catch(() => ({ success: true, logs: ['[Logs not available or empty]'] })),
        getAllPollenRequests().catch(() => ({ success: true, requests: [] }))
      ]);
      setUsers(usersData);
      setLogs(logsData.logs || []);
      setAllRequests(requestsData.requests || []);
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
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      await deleteAdminUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      if (expandedUserId === userId) setExpandedUserId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user.');
    }
  };

  const handleToggleUserStatus = async (userId: string, username: string) => {
    const action = users.find(u => u.id === userId)?.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} user "${username}"?`)) return;
    try {
      const res = await toggleUserActive(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: res.is_active } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle user status.');
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
      alert("Please enter a valid positive decimal value.");
      return;
    }
    try {
      await editUserPollenCredits(userId, amt);
      setUsers(users.map(u => u.id === userId ? { ...u, pollen_balance: amt } : u));
      alert("User pollen balance limit updated successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to update pollen balance.");
    }
  };

  const handleReviewPollenRequest = async (requestId: string, status: 'approved' | 'denied') => {
    try {
      await reviewPollenRequest(requestId, status);
      // Update local request state
      setAllRequests(allRequests.map(r => r.id === requestId ? { ...r, status } : r));
      
      // If approved, update user's local pollen balance in the UI
      if (status === 'approved') {
        const reqObj = allRequests.find(r => r.id === requestId);
        if (reqObj) {
          setUsers(users.map(u => u.id === reqObj.user_id ? { ...u, pollen_balance: (u.pollen_balance ?? 20.0) + reqObj.amount } : u));
          if (expandedUserId === reqObj.user_id) {
            setEditPollenVal(((users.find(u => u.id === reqObj.user_id)?.pollen_balance ?? 20.0) + reqObj.amount).toString());
          }
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to review credit request.');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm(`Are you sure you want to delete job "${jobId}" and all its output files?`)) return;
    try {
      await deleteJob(jobId);
      setExpandedUserJobs(expandedUserJobs.filter(j => j.job_id !== jobId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete job.');
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
        {(['users', 'logs'] as const).map((tab) => (
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
            {tab === 'users' ? 'User Accounts' : 'System Logs'}
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
                        {user.role !== 'admin' ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>System Protected</span>
                        )}
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

                              {/* Edit Pollen Credits */}
                              <div className="glass" style={{ flex: '1 1 350px', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                <h4 style={{ margin: '0 0 8px', fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                                  Pollen Quota Limit
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
                                  Current Limit: <strong style={{ color: 'var(--accent-purple)' }}>{(user.pollen_balance ?? 20.0).toFixed(4)}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Pollen Requests List */}
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
    </div>
  );
}
