/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                // Layered Backgrounds (Teal-Blue Theme)
                background: '#0d1b2a',      // Deep teal-navy (similar to reference)
                chatPanel: '#1b2838',       // Dark teal-slate (chat area)
                sidebar: '#1a2332',         // Sidebar teal-navy
                header: '#152232',          // Header dark teal

                // Message Bubbles
                messageBubble: {
                    outgoing: '#2b7de9',    // Bright vibrant blue (like reference)
                    incoming: '#2d3e50',    // Medium slate (clearly visible)
                },

                // Surface variants
                surface: {
                    light: '#2d3e50',
                    DEFAULT: '#1a2332',
                    dark: '#0d1b2a',
                },

                // Typography (High Contrast)
                text: {
                    primary: '#E5E7EB',     // Main text
                    secondary: '#9CA3AF',   // Labels, metadata
                    muted: '#6B7280',       // Timestamps
                },

                // Accent System (Blue)
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2b7de9',         // Main accent (matches outgoing)
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },

                // Status Colors
                accent: {
                    emerald: '#10b981',     // Online status
                    blue: '#2b7de9',        // Buttons, highlights
                }
            },
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
                'medium': '0 8px 30px -4px rgba(0, 0, 0, 0.5)',
                'glow': '0 0 15px -1px rgba(43, 125, 233, 0.5)',
                'header': '0 4px 30px -4px rgba(0, 0, 0, 0.6)',
                'input': '0 -4px 20px -4px rgba(0, 0, 0, 0.4)',
                'bubble-out': '0 2px 12px -2px rgba(43, 125, 233, 0.35), 0 4px 8px -4px rgba(0, 0, 0, 0.3)',
                'bubble-in': '0 2px 12px -2px rgba(0, 0, 0, 0.5), 0 4px 8px -4px rgba(0, 0, 0, 0.3)',
            },
            animation: {
                'fade-in': 'fadeIn 150ms ease-out',
                'scale-in': 'scaleIn 150ms ease-out',
                'typing': 'typing 1.4s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                typing: {
                    '0%, 100%': { opacity: '0.2' },
                    '50%': { opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
