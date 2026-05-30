import axios from "axios";

console.log("API FILE LOADED");
console.log("BASE URL =", "https://articlehub-3lbw.onrender.com");

const api = axios.create({
  baseURL: "https://articlehub-3lbw.onrender.com",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;