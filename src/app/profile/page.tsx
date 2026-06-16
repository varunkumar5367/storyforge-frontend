// src/app/profile/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserResponse,
  PollenRequest,
  updateProfile,
  changePassword,
  requestPollenCredits,
  getUserPollenRequests
} from '@/utils/api';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit Mode states
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    display_name: '',
    email: '',
    phone: '',
    dob: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Security (Change Password) states
  const [securityData, setSecurityData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Pollen requests states
  const [pollenRequests, setPollenRequests] = useState<PollenRequest[]>([]);
  const [reqAmount, setReqAmount] = useState<string>('');
  const [reqMessage, setReqMessage] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState<string | null>(null);

  // Image Upload / Crop States
  const [avatarData, setAvatarData] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile responsive layout detector
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Profile & Requests
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('storyforge_token');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const apiBase = localStorage.getItem('storyforge_api_url') || 'http://127.0.0.1:8000';
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('storyforge_token');
        localStorage.removeItem('storyforge_username');
        localStorage.removeItem('storyforge_role');
        window.dispatchEvent(new Event('auth-changed'));
        router.push('/login');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile.');
      }
      
      const data: UserResponse = await response.json();
      setUser(data);
      setFormData({
        full_name: data.full_name || '',
        display_name: data.display_name || '',
        email: data.email || '',
        phone: data.phone || '',
        dob: data.dob || ''
      });
      setAvatarData(data.avatar_data || '');
      
      // Fetch Pollen requests (only if user is not admin)
      if (data.role !== 'admin') {
        const reqsRes = await getUserPollenRequests();
        setPollenRequests(reqsRes.requests || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Profile Completion Meter
  const getProfileCompletion = () => {
    if (!user) return 0;
    let score = 0;
    // Required fields: Full Name, Display Name, Email (validated format)
    const hasName = formData.full_name && formData.full_name.trim().length > 0;
    const hasDisplay = formData.display_name && formData.display_name.trim().length > 0;
    const emailValid = formData.email && formData.email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    
    if (hasName) score += 34;
    if (hasDisplay) score += 33;
    if (emailValid) score += 33;
    return score;
  };

  const isProfileComplete = getProfileCompletion() === 100;

  // Handle Profile Details Change
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      alert("Full Name is required.");
      return;
    }
    if (!formData.display_name.trim()) {
      alert("Display Name is required.");
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      alert("Please enter a valid email address.");
      return;
    }

    setSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      const updated = await updateProfile(formData);
      setUser(updated);
      setEditMode(false);
      setProfileSuccessMsg("Profile details updated successfully!");
      setTimeout(() => setProfileSuccessMsg(null), 3000);
      
      // Update global display username in localStorage if display_name changed
      if (formData.display_name) {
        localStorage.setItem('storyforge_username', formData.display_name);
        window.dispatchEvent(new Event('auth-changed'));
      }
    } catch (err: any) {
      alert(err.message || "Failed to update profile details.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Update
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (!securityData.old_password) {
      setPasswordErrorMsg("Current password is required.");
      return;
    }
    if (securityData.new_password.length < 6) {
      setPasswordErrorMsg("New password must be at least 6 characters.");
      return;
    }
    if (securityData.new_password !== securityData.confirm_password) {
      setPasswordErrorMsg("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      await changePassword({
        old_password: securityData.old_password,
        new_password: securityData.new_password
      });
      setSecurityData({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordSuccessMsg("Password updated successfully!");
      setTimeout(() => setPasswordSuccessMsg(null), 3000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || "Failed to change password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Pollen Credit Request Submit
  const handlePollenRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProfileComplete) return;

    const amt = parseFloat(reqAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid positive number of credits.");
      return;
    }

    setSubmittingRequest(true);
    setRequestSuccessMsg(null);
    try {
      const res = await requestPollenCredits(amt, reqMessage);
      setPollenRequests([res.request, ...pollenRequests]);
      setReqAmount('');
      setReqMessage('');
      setRequestSuccessMsg("Pollen credits request submitted to admin!");
      setTimeout(() => setRequestSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to submit pollen request.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Avatar Upload / Canvas Cropping
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCropSrc(event.target.result as string);
          setCropMode(true);
          setZoom(1.0);
          setPanX(0);
          setPanY(0);
          
          const img = new Image();
          img.onload = () => {
            imageRef.current = img;
            drawCroppedImage(img, 1.0, 0, 0);
          };
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCroppedImage = (img: HTMLImageElement, z: number, px: number, py: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw circular clipping path
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.clip();

    // Centered drawing calculations with zoom & pan offsets
    const minDim = Math.min(img.width, img.height);
    const sWidth = minDim / z;
    const sHeight = minDim / z;
    const sx = (img.width - sWidth) / 2 + px;
    const sy = (img.height - sHeight) / 2 + py;

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  // Redraw when zoom or pan changes
  useEffect(() => {
    if (cropMode && imageRef.current) {
      drawCroppedImage(imageRef.current, zoom, panX, panY);
    }
  }, [cropMode, zoom, panX, panY]);

  const handleSaveCroppedImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    setUploadingImage(true);
    try {
      await updateProfile({ avatar_data: base64Image });
      setAvatarData(base64Image);
      setCropMode(false);
      setCropSrc(null);
      // Update global avatar in layout
      window.dispatchEvent(new Event('auth-changed'));
    } catch (err: any) {
      alert("Failed to save avatar image.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <svg className="animate-spin-fast" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>Loading profile details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px max(4vw, 24px)', color: 'var(--accent-red)' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  const completion = getProfileCompletion();

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '40px max(4vw, 24px)', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 800, letterSpacing: '-0.75px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          User Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Manage your personal identity details, security credentials, and pollen credit requests.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 350px', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Side: Identity & Security Form Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', order: isMobile ? 2 : 1 }}>
          
          {/* Identity Section */}
          <div className="glass" style={{ padding: '32px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Personal Identity
              </h3>
              
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
                >
                  Edit Profile
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleProfileSave}
                    disabled={savingProfile}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-purple)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {savingProfile ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      if (user) {
                        setFormData({
                          full_name: user.full_name || '',
                          display_name: user.display_name || '',
                          email: user.email || '',
                          phone: user.phone || '',
                          dob: user.dob || ''
                        });
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {profileSuccessMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: 'var(--accent-green)',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                {profileSuccessMsg}
              </div>
            )}

            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                
                {/* Full Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Full Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    disabled={!editMode}
                    placeholder="Enter first + last name"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: editMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.01)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Display Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Username / Display Name <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    disabled={!editMode}
                    placeholder="E.g. CaptainCook"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: editMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.01)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Email Address <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!editMode}
                  placeholder="name@domain.com"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: editMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.01)',
                    color: '#ffffff',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                
                {/* Contact Phone (Optional) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editMode}
                    placeholder="+1 (555) 019-2834"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: editMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.01)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Date of Birth (Optional) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Date of Birth (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    disabled={!editMode}
                    placeholder="YYYY-MM-DD"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: editMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.01)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Account Security (Password change) Card */}
          <div className="glass" style={{ padding: '32px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Account Security
            </h3>

            {passwordSuccessMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: 'var(--accent-green)',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                {passwordSuccessMsg}
              </div>
            )}

            {passwordErrorMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-red)',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                {passwordErrorMsg}
              </div>
            )}

            <form onSubmit={handlePasswordSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Password</label>
                <input
                  type="password"
                  value={securityData.old_password}
                  onChange={(e) => setSecurityData({ ...securityData, old_password: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: '#ffffff',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
                  <input
                    type="password"
                    value={securityData.new_password}
                    onChange={(e) => setSecurityData({ ...securityData, new_password: e.target.value })}
                    placeholder="At least 6 chars"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm Password</label>
                  <input
                    type="password"
                    value={securityData.confirm_password}
                    onChange={(e) => setSecurityData({ ...securityData, confirm_password: e.target.value })}
                    placeholder="Repeat new password"
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: '#ffffff',
                      outline: 'none',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingPassword}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  width: 'fit-content',
                  marginTop: '10px',
                  transition: 'var(--transition-fast)'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
              >
                {updatingPassword ? 'Changing Password…' : 'Update Password'}
              </button>
            </form>
          </div>
          
        </div>

        {/* Right Side: Profile Photo, Completion Indicator & Quota Requests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', order: isMobile ? 1 : 2 }}>
          
          {/* Completion Indicator & Avatar Photo Card */}
          <div className="glass" style={{ padding: '32px 24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            
            {/* Completion Meter */}
            <div style={{ width: '100%', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <span>Profile Completion</span>
                <span style={{ color: isProfileComplete ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                  {completion}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${completion}%`,
                  height: '100%',
                  backgroundColor: isProfileComplete ? 'var(--accent-green)' : 'var(--accent-orange)',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              {!isProfileComplete && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                  Fill in Full Name, Display Name, and Email to reach 100%.
                </p>
              )}
            </div>

            {/* Profile Avatar */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-purple)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '44px',
                border: '3px solid var(--border-color)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                overflow: 'hidden'
              }}>
                {avatarData ? (
                  <img src={avatarData} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (user?.display_name || user?.username || 'U').charAt(0).toUpperCase()
                )}
              </div>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-purple)',
                  color: '#ffffff',
                  border: '2px solid var(--bg-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                  transition: 'var(--transition-fast)'
                }}
                title="Upload Profile Picture"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />

            <h4 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>
              {user?.display_name || user?.username}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
              {user?.role} Account
            </p>

            {/* Canvas Cropper Dialog overlay */}
            {cropMode && cropSrc && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '24px'
              }}>
                <div className="glass" style={{
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  maxWidth: '400px',
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Crop &amp; Resize Profile Photo</h4>
                  
                  {/* Visual canvas */}
                  <div style={{ border: '2px dashed var(--accent-purple)', borderRadius: '50%', overflow: 'hidden', padding: '2px', backgroundColor: 'rgba(0,0,0,0.5)', marginBottom: '16px' }}>
                    <canvas
                      ref={canvasRef}
                      width={150}
                      height={150}
                      style={{ borderRadius: '50%', display: 'block', width: '150px', height: '150px' }}
                    />
                  </div>

                  {/* Sliders */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Zoom</span>
                        <span>{zoom.toFixed(1)}x</span>
                      </label>
                      <input
                        type="range"
                        min="1.0"
                        max="3.0"
                        step="0.1"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pan X</label>
                        <input
                          type="range"
                          min="-200"
                          max="200"
                          step="5"
                          value={panX}
                          onChange={(e) => setPanX(parseInt(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                        />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pan Y</label>
                        <input
                          type="range"
                          min="-200"
                          max="200"
                          step="5"
                          value={panY}
                          onChange={(e) => setPanY(parseInt(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button
                      onClick={handleSaveCroppedImage}
                      disabled={uploadingImage}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--accent-purple)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {uploadingImage ? 'Saving…' : 'Apply Crop'}
                    </button>
                    <button
                      onClick={() => {
                        setCropMode(false);
                        setCropSrc(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        borderRadius: '6px',
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Request Pollen Credits (Non-admins only) */}
          {user?.role !== 'admin' && (
            <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Request Credits
              </h3>

              {!isProfileComplete ? (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  color: 'var(--accent-orange)',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  🔒 <strong>Feature Locked</strong>: You must fully complete your profile (Full Name, Display Name, Email) to request pollen credits from the administrator.
                </div>
              ) : (
                <form onSubmit={handlePollenRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Request additional credits to generate illustrations.
                  </p>

                  {requestSuccessMsg && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--border-radius)',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      color: 'var(--accent-green)',
                      fontSize: '12px'
                    }}>
                      {requestSuccessMsg}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount (Credits)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={reqAmount}
                      onChange={(e) => setReqAmount(e.target.value)}
                      placeholder="E.g. 50"
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        color: '#ffffff',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Attach Message / Reason</label>
                    <textarea
                      required
                      value={reqMessage}
                      onChange={(e) => setReqMessage(e.target.value)}
                      placeholder="Why do you need more credits?"
                      rows={3}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        color: '#ffffff',
                        fontSize: '13px',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingRequest}
                    style={{
                      padding: '10px',
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
                    {submittingRequest ? 'Submitting Request…' : 'Submit Request'}
                  </button>
                </form>
              )}

              {/* Requests History List */}
              {user?.role !== 'admin' && pollenRequests.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Request History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {pollenRequests.map((req) => (
                      <div key={req.id} style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.01)'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>+{req.amount} Credits</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(req.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: req.status === 'pending' ? 'rgba(245,158,11,0.15)' : req.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: req.status === 'pending' ? 'var(--accent-orange)' : req.status === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
