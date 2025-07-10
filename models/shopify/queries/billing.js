export default {
    activeSub: `
    {
      currentAppInstallation {
        launchUrl
        activeSubscriptions {
          id
          name
          status
          currentPeriodEnd
          createdAt
        }
      }
    }`
}