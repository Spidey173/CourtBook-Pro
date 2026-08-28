/**
 * Enterprise API Client with automatic CSRF header injection and unified error handling.
 */
class ApiClient {
    static getCsrfToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    static async request(url, options = {}) {
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRFToken': ApiClient.getCsrfToken()
        };

        options.headers = {
            ...defaultHeaders,
            ...(options.headers || {})
        };

        try {
            const response = await fetch(url, options);
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const errorMessage = (data && (data.message || data.error)) || `HTTP Error ${response.status}`;
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            console.error(`API Request Error [${options.method || 'GET'} ${url}]:`, error);
            throw error;
        }
    }

    static get(url, options = {}) {
        return ApiClient.request(url, { ...options, method: 'GET' });
    }

    static post(url, body = {}, options = {}) {
        return ApiClient.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static put(url, body = {}, options = {}) {
        return ApiClient.request(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    static delete(url, options = {}) {
        return ApiClient.request(url, { ...options, method: 'DELETE' });
    }

    /**
     * Display a modern toast notification.
     */
    static showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

window.ApiClient = ApiClient;
