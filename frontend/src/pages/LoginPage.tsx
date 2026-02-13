import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { useNavigate, Link } from "react-router-dom";

const LoginPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/chat");
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post("/auth/login", { username, password });
            // Assuming response.data contains { user, token } based on backend
            // Adjust if backend returns differently (e.g. response.data.data.user)
            // response.data.data = { token, userId, username, email }
            const { token, userId, username: apiUsername, email } = response.data.data;

            const user = {
                _id: userId,
                username: apiUsername,
                email: email || "" // Handle missing email
            };

            login(user, token);
            navigate("/chat");
        } catch (err: any) {
            console.error("Login failed", err);
            setError(err.response?.data?.message || "Login failed");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-[#e5e7eb] font-sans antialiased p-4 relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-accent-emerald/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md p-8 bg-sidebar border border-white/5 rounded-2xl shadow-medium relative z-10 animate-fade-in backdrop-blur-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600/20 rounded-2xl mb-4 shadow-glow border border-primary-500/20">
                        <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
                    <p className="text-gray-400 mt-2">Log in to your account to continue</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-shake">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">Username</label>
                        <input
                            type="text"
                            placeholder="Enter your username"
                            className="w-full px-4 py-3 bg-surface-light border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all shadow-inner"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <a href="#" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">Forgot?</a>
                        </div>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-surface-light border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all shadow-inner"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="mt-4 px-4 py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-glow hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <span>Login</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-white/5">
                    <p className="text-gray-400">
                        Don't have an account? <Link to="/register" className="text-primary-400 font-semibold hover:text-primary-300 transition-colors">Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
