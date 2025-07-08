export default {
    activeSub: `
    {
      currentAppInstallation {
        launchUrl
        activeSubscriptions {
          id
          status
        }
      }
    }`
}