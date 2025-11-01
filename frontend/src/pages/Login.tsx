import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted!', { username, password }); // Debug log
    
    if (!username || !password) {
      console.log('Missing username or password'); // Debug log
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setIsLoading(true);
    console.log('Starting login process...'); // Debug log
    
    try {
      console.log('Calling login function...'); // Debug log
      await login(username, password);
      console.log('Login successful!'); // Debug log
      toast.success('Đăng nhập thành công!');
    } catch (error: any) {
      console.error('Login error:', error); // Debug log
      toast.error(error.response?.data?.detail || 'Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay để làm mờ background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Login Form với Liquid Glass Effect */}
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="liquid-glass-container">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto h-24 w-24 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl">
              <img 
                src="/logo.jpg" 
                alt="Blockchain Gateway Logo" 
                className="h-16 w-16 object-cover rounded-full"
                style={{
                  clipPath: 'circle(50%)',
                  objectPosition: 'center'
                }}
              />
            </div>
            <h2 className="mt-6 text-4xl font-bold text-white drop-shadow-lg" style={{fontFamily: "'Courier New', Courier, monospace"}}>
              ICTU Blockchain Network
            </h2>
          </div>

          {/* Login Form */}
          <form className="space-y-6 relative z-10" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Username Input */}
              <div className="liquid-glass-input-group">
                <label htmlFor="username" className="liquid-glass-label">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="liquid-glass-input"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="liquid-glass-input-glow"></div>
                </div>
              </div>

              {/* Password Input */}
              <div className="liquid-glass-input-group">
                <label htmlFor="password" className="liquid-glass-label">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="liquid-glass-input pr-12"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="liquid-glass-input-glow"></div>
                  <button
                    type="button"
                    className="liquid-glass-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="liquid-glass-button w-full"
                onClick={(e) => {
                  console.log('Button clicked!', e);
                  handleSubmit(e);
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Đăng nhập
                  </>
                )}
              </button>
              
              {/* Test Button */}
              <button
                type="button"
                onClick={() => {
                  console.log('Test button clicked!');
                  alert('Test button works!');
                }}
                className="mt-2 w-full bg-red-500 text-white p-2 rounded"
              >
                Test Button (Click me!)
              </button>
            </div>

            {/* Demo Accounts */}
            <div className="liquid-glass-demo-accounts">
              <p className="text-white/70 text-sm font-medium mb-3" style={{fontFamily: "'Courier New', Courier, monospace"}}>
                Demo accounts:
              </p>
              <div className="space-y-2 text-xs">
                <div className="text-white/60 bg-white/5 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10" style={{fontFamily: "'Courier New', Courier, monospace"}}>
                  <span className="font-semibold text-white/80">Admin:</span> admin / admin123
                </div>
                <div className="text-white/60 bg-white/5 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10" style={{fontFamily: "'Courier New', Courier, monospace"}}>
                  <span className="font-semibold text-white/80">Org Admin:</span> orgadmin / org123
                </div>
                <div className="text-white/60 bg-white/5 px-3 py-2 rounded-lg backdrop-blur-sm border border-white/10" style={{fontFamily: "'Courier New', Courier, monospace"}}>
                  <span className="font-semibold text-white/80">User:</span> user / user123
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .liquid-glass-container {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.15),
            inset 0 -1px 0 rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          font-family: 'Courier New', Courier, monospace;
        }

        .liquid-glass-container:hover {
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(255, 255, 255, 0.12);
        }

        .liquid-glass-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
        }

        .liquid-glass-container::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          animation: rotate 20s linear infinite;
          opacity: 0.3;
          pointer-events: none;
          z-index: 1;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .liquid-glass-input-group {
          position: relative;
        }

        .liquid-glass-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 0.5rem;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          font-family: 'Courier New', Courier, monospace;
        }

        .liquid-glass-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          backdrop-filter: blur(15px);
          transition: all 0.3s ease;
          position: relative;
          z-index: 2;
          font-family: 'Courier New', Courier, monospace;
        }

        .liquid-glass-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .liquid-glass-input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.4);
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 0 0 3px rgba(59, 130, 246, 0.08),
            0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }

        .liquid-glass-input:hover:not(:focus) {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
        }

        .liquid-glass-input-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 12px;
          background: linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .liquid-glass-input:focus + .liquid-glass-input-glow {
          opacity: 1;
        }

        .liquid-glass-button {
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.6), rgba(147, 51, 234, 0.6));
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 1rem;
          backdrop-filter: blur(15px);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          outline: none;
          pointer-events: auto;
          z-index: 10;
          font-family: 'Courier New', Courier, monospace;
        }

        .liquid-glass-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s ease;
        }

        .liquid-glass-button:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 8px 25px rgba(59, 130, 246, 0.25),
            0 4px 12px rgba(0, 0, 0, 0.15);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.7), rgba(147, 51, 234, 0.7));
        }

        .liquid-glass-button:hover::before {
          left: 100%;
        }

        .liquid-glass-button:active {
          transform: translateY(0) scale(0.98);
          box-shadow: 
            0 4px 15px rgba(59, 130, 246, 0.4),
            0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .liquid-glass-button:focus {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
        }

        .liquid-glass-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3));
        }

        .liquid-glass-button:disabled:hover {
          transform: none;
          box-shadow: none;
        }

        .liquid-glass-toggle-btn {
          position: absolute;
          inset-y: 0;
          right: 0;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          color: rgba(255, 255, 255, 0.6);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          border-radius: 0 12px 12px 0;
        }

        .liquid-glass-toggle-btn:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.08);
        }

        .liquid-glass-toggle-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.12);
        }

        .liquid-glass-toggle-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .liquid-glass-toggle-btn:disabled:hover {
          color: rgba(255, 255, 255, 0.6);
          background: transparent;
          transform: none;
        }

        .liquid-glass-demo-accounts {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        `
      }} />
    </div>
  );
};

export default Login;
