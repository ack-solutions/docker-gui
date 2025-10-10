import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  timeout: 300000, // 5 minutes for long-running operations like pulling images
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipUnauthorizedEvent =
      error.config?.headers?.["x-skip-auth-redirect"] === "true" ||
      error.config?.headers?.["X-Skip-Auth-Redirect"] === "true";

    if (error.response?.status === 401 && typeof window !== "undefined" && !skipUnauthorizedEvent) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
