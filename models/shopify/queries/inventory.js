export default {
    inventory: `
query InventoryItems($cursor: String) {
    inventoryItems(first: 250, after: $cursor) {
        pageInfo {
            hasNextPage
        }
        edges {
            cursor
            node {
                id
                sku
                variant {
                    barcode
                    id
                    inventoryPolicy
                    inventoryQuantity
                    sku
                }
            }
        }
    }
}`
}