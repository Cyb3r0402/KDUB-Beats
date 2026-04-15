export const CONTROL_CENTER_COOKIE_NAME = "kdub_control_center_access";

export function getControlCenterCredentials() {
  return {
    username: process.env.CONTROL_CENTER_USERNAME || "",
    password: process.env.CONTROL_CENTER_PASSWORD || "",
    accessToken: process.env.CONTROL_CENTER_ACCESS_TOKEN || "",
  };
}

export function isControlCenterConfigured() {
  const { username, password, accessToken } = getControlCenterCredentials();
  return Boolean(username && password && accessToken);
}

export function isAuthorizedControlCenterSession(token: string | undefined) {
  const { accessToken } = getControlCenterCredentials();
  return Boolean(accessToken) && token === accessToken;
}

export function isValidControlCenterLogin(username: string, password: string) {
  const credentials = getControlCenterCredentials();

  return (
    Boolean(credentials.username && credentials.password && credentials.accessToken) &&
    username === credentials.username &&
    password === credentials.password
  );
}
