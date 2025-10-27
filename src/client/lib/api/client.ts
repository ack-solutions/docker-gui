import axios, { AxiosError } from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  timeout: 300000, // 5 minutes for long-running operations like pulling images
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

// Request interceptor for better error handling
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching issues
    config.headers["X-Request-Time"] = new Date().toISOString();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for enhanced error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const skipUnauthorizedEvent =
      error.config?.headers?.["x-skip-auth-redirect"] === "true" ||
      error.config?.headers?.["X-Skip-Auth-Redirect"] === "true";

    if (error.response?.status === 401 && typeof window !== "undefined" && !skipUnauthorizedEvent) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    // Enhanced error messages
    if (error.code === "ECONNABORTED") {
      error.message = "Request timeout. The operation took too long to complete.";
    } else if (error.code === "ERR_NETWORK") {
      error.message = "Network error. Please check your connection.";
    } else if (error.response) {
      // Server responded with error
      const data = error.response.data as any;
      if (data?.message) {
        error.message = data.message;
      } else if (data?.error) {
        error.message = data.error;
      } else {
        switch (error.response.status) {
          case 400:
            error.message = "Bad request. Please check your input.";
            break;
          case 403:
            error.message = "Access denied. You don't have permission.";
            break;
          case 404:
            error.message = "Resource not found.";
            break;
          case 500:
            error.message = "Server error. Please try again later.";
            break;
          case 502:
            error.message = "Bad gateway. The server is temporarily unavailable.";
            break;
          case 503:
            error.message = "Service unavailable. Please try again later.";
            break;
          default:
            error.message = `Request failed with status ${error.response.status}`;
        }
      }
    } else if (error.request) {
      // Request made but no response
      error.message = "No response from server. Please check if Docker is running.";
    }

    return Promise.reject(error);
  }
);

export default apiClient;
