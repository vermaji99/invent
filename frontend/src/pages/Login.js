import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './Login.css';
import api from '../utils/api';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [otpStep, setOtpStep] = useState('request');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      toast.error(result.message || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="brand-title">VSKK</h1>
          <p className="brand-subtitle">Vaibhav Swarn Kala Kendra</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="login-footer">
          <button
            className="link-btn"
            type="button"
            onClick={() => { setShowForgot(true); setOtpStep('request'); setOtpEmail(''); setOtpCode(''); setNewPassword(''); }}
          >
            Forgot password?
          </button>
        </div>
      </div>
      {showForgot && (
        <div className="modal-overlay">
          <div className="modal-content small">
            <h2>Admin Password Reset</h2>
            {otpStep === 'request' && (
              <div className="form-group">
                <label>Admin Email</label>
                <input
                  type="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="Enter admin email"
                />
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForgot(false)}>Close</button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={otpBusy || !otpEmail}
                    onClick={async () => {
                      if (!otpEmail) return;
                      setOtpBusy(true);
                      try {
                        await api.post('/api/admin/otp/request', { email: otpEmail, purpose: 'RESET' });
                        toast.success('OTP sent to your email. Check for a reset link after verification.');
                        setOtpStep('reset');
                      } catch (e) {
                        if (e.response?.status === 429) {
                          toast.error('Too many requests. Please wait 2 minutes before trying again.');
                        } else if (e.response?.status === 500) {
                          toast.error('Server error while sending OTP. Verify email settings and try again.');
                        } else {
                          const msg = e.response?.data?.message || 'Failed to send OTP';
                          toast.error(msg);
                        }
                      } finally {
                        setOtpBusy(false);
                      }
                    }}
                  >
                    {otpBusy ? 'Sending…' : 'Send OTP'}
                  </button>
                </div>
              </div>
            )}
            {otpStep === 'reset' && (
              <>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>OTP Code</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    placeholder="6-digit OTP"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForgot(false)}>Close</button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={otpBusy || !otpEmail || otpCode.length !== 6 || newPassword.length < 6}
                    onClick={async () => {
                      setOtpBusy(true);
                      try {
                        await api.post('/api/admin/otp/reset-password', { email: otpEmail, code: otpCode, newPassword });
                        toast.success('Password reset successful');
                        setShowForgot(false);
                      } catch (e) {
                        const msg = e.response?.data?.message || 'Failed to reset password';
                        toast.error(msg);
                      } finally {
                        setOtpBusy(false);
                      }
                    }}
                  >
                    {otpBusy ? 'Resetting…' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

