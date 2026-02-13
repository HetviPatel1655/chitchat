import { useState } from "react";
import api from "../services/api";
import { useNavigate, Link } from "react-router-dom";

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/auth/register", { username, email, password });
            navigate("/login");
        } catch (err: any) {
            console.error("Registration failed", err);
            setError(err.response?.data?.message || "Registration failed");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-[#e5e7eb] font-sans antialiased p-4 relative overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-accent-emerald/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary-600/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md p-8 bg-sidebar border border-white/5 rounded-2xl shadow-medium relative z-10 animate-fade-in backdrop-blur-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-emerald/20 rounded-2xl mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-accent-emerald/20">
                        <svg className="w-8 h-8 text-accent-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
                    <p className="text-gray-400 mt-2">Join our messaging community today</p>
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
                            placeholder="Choose a username"
                            className="w-full px-4 py-3 bg-surface-light border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-emerald/20 focus:border-accent-emerald/50 transition-all shadow-inner"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            className="w-full px-4 py-3 bg-surface-light border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-emerald/20 focus:border-accent-emerald/50 transition-all shadow-inner"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full px-4 py-3 bg-surface-light border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-emerald/20 focus:border-accent-emerald/50 transition-all shadow-inner"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="mt-4 px-4 py-3.5 bg-accent-emerald hover:bg-emerald-400 text-[#0f172a] font-bold rounded-xl shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.4)] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <span>Create Account</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-white/5">
                    <p className="text-gray-400">
                        Already have an account? <Link to="/login" className="text-accent-emerald font-semibold hover:text-emerald-400 transition-colors">Login here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
