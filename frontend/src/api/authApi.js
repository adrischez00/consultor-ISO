import { requestJson } from "./httpClient";

function validateAuthResponse(data, fallbackMessage) {
  if (!data || typeof data !== "object" || typeof data.access_token !== "string") {
    throw new Error(fallbackMessage);
  }
  return data;
}

export async function registerRequest(payload) {
  const data = await requestJson("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No se pudo completar el registro.",
  });
  return validateAuthResponse(data, "Respuesta inválida al registrar.");
}

export async function loginRequest(payload) {
  const data = await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackMessage: "No se pudo iniciar sesión.",
  });
  return validateAuthResponse(data, "Respuesta inválida al iniciar sesión.");
}

export async function fetchMe() {
  const data = await requestJson("/auth/me", {
    method: "GET",
    fallbackMessage: "No se pudo cargar la sesión actual.",
  });
  if (!data || typeof data !== "object" || typeof data.user !== "object") {
    throw new Error("Respuesta inválida al cargar sesión.");
  }
  return data;
}
