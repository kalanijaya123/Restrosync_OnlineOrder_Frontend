const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const getApiUrl = (endpoint: string) => {
    return `${API_URL}/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`
}

export default API_URL
