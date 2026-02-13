import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (userData: User, token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(sessionStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = sessionStorage.getItem("token");
        const storedUser = sessionStorage.getItem("user");

        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(parsedUser);
            } catch (error) {
                console.error("Failed to parse user from session storage", error);
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                setToken(null);
                setUser(null);
            }
        } else {
            // Clean up if incomplete data
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            setToken(null);
            setUser(null);
        }
        setLoading(false);
    }, []);

    const login = (userData: User, newToken: string) => {
        if (!userData || !newToken) {
            console.error("AuthContext: Attempted login with missing data", { userData, newToken });
            return;
        }
        setUser(userData);
        setToken(newToken);
        sessionStorage.setItem("token", newToken);
        sessionStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        console.log("AuthContext: Logout called");
        setUser(null);
        setToken(null);
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
