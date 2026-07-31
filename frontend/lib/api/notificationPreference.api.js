// frontend/lib/api/notificationPreference.api.js
import api from "./axiosInstance";

export const notificationPreferenceAPI = {
  get: () => api.get("/tenants/notification-preferences"),
  update: (prefs) => api.put("/tenants/notification-preferences", prefs),
};