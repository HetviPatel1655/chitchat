import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', // Adjust if your backend runs on a different port
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the JWT token in every request
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.log("API 401 Interceptor Triggered!", error.config.url);
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// File Upload Helper
export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/chat/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
};

export default api;
