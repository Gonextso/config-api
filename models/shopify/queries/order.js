export default {
    openOrders: `
query Orders($cursor: String) {
    orders(first: 250, after: $cursor, query: "(status:open OR status:cancelled) AND created_at:>=@start_date AND created_at:<=@end_date") {
        pageInfo {
            hasNextPage
        }
        edges {
            cursor
            node {
                cancelReason
                createdAt
                currencyCode
                fullyPaid
                id
                name
                netPayment
                note
                totalDiscounts
                totalPrice
                billingAddress {
                    address1
                    address2
                    city
                    id
                    lastName
                    phone
                    zip
                }
                customer {
                    displayName
                    email
                    firstName
                    id
                    lastName
                    phone
                    note
                }
                lineItems(first: 250) {
                    nodes {
                        discountedUnitPrice
                        id
                        originalUnitPrice
                        quantity
                        refundableQuantity
                        sku
                        totalDiscount
                        nonFulfillableQuantity
                        variant {
                            barcode
                        }
                    }
                }
                shippingAddress {
                    address1
                    address2
                    city
                    firstName
                    id
                    name
                    lastName
                    name
                    phone
                    zip
                }
                tags
            }
        }
    }
}`
}