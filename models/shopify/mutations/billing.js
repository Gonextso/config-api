export default {
    createSub: `
mutation ($name: String!, $returnUrl: URL!, $price: Decimal!) {
  appSubscriptionCreate(
    name: $name
    returnUrl: $returnUrl
    lineItems: [{
      plan: {
        appRecurringPricingDetails: {
          interval: EVERY_30_DAYS
          price: { amount: $price, currencyCode: USD }
        }
      }
    }]
  ) {
    confirmationUrl
    appSubscription { id }
    userErrors { field message }
  }
}`
}