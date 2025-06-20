export default {
    /**
     * Publishes a resource to a channel. If the resource is a product, then it's visible in the channel only if the product status is active. Products that are sold exclusively on subscription (requiresSellingPlan: true) can be published only on online stores.
     */
    publish: `
mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable {
      availablePublicationsCount {
        count
      }
      resourcePublicationsCount {
        count
      }
    }
    shop {
      publicationCount
    }
    userErrors {
      field
      message
    }
  }
}`
}