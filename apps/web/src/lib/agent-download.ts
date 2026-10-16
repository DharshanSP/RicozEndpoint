export const LOCAL_AGENT_DOWNLOAD_PATH = '/downloads/RicozEndpointAgent.exe';

export const RELEASE_AGENT_DOWNLOAD_URL =
  'https://github.com/DharshanSP/RicozEndpoint/releases/latest/download/RicozEndpointAgent.exe';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Release assets are the only agent build available to a deployed frontend:
 * the local `public/downloads` files are git-ignored build output. Local
 * development keeps using the freshly built executable.
 */
export function resolveAgentDownloadUrl(
  configuredUrl: string | undefined,
  hostname: string | undefined,
): string {
  if (configuredUrl) return configuredUrl;
  if (hostname && LOCAL_HOSTNAMES.has(hostname)) return LOCAL_AGENT_DOWNLOAD_PATH;
  return RELEASE_AGENT_DOWNLOAD_URL;
}
