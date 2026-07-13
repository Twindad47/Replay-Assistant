const fallbackConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
      ]
    }
  ]
};

let configPromise = null;

export function getRtcConfig() {
  if (!configPromise) {
    configPromise = fetch("/api/config", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load WebRTC configuration.");
        return response.json();
      })
      .then((config) => ({
        iceServers: Array.isArray(config.iceServers) && config.iceServers.length
          ? config.iceServers
          : fallbackConfig.iceServers
      }))
      .catch((error) => {
        console.warn("Using fallback STUN configuration.", error);
        return fallbackConfig;
      });
  }

  return configPromise;
}
