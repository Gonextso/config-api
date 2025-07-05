export default {
    createSub: `
mutation ($name: String!, $returnUrl: URL!, $price: Decimal!, $test: Boolean = false ) {
  appSubscriptionCreate(
    name: $name
    returnUrl: $returnUrl
    test: $test 
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
    appSubscription {
      id
      lineItems { id }
    }
    userErrors { field message }
  }
}`
}