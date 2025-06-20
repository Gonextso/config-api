export default {
    all: `
query ($cursor: String) {
    products(first: 250, after: $cursor) {
        pageInfo {
            hasNextPage
        }
        edges {
            cursor
            node {
                id
                title
                handle
                descriptionHtml
                createdAt
                updatedAt
                variants(first: 100) {
                edges {
                    node {
                    id
                    title
                    sku
                    price
                    }
                }
                }
                images(first: 10) {
                edges {
                    node {
                    src
                    }
                }
                }
            }
        }
    }
}`,
    childCategories: `
query FetchChildCategories($categoryId: ID!) {
  taxonomy {
    categories(first: 250, ids: [$categoryId]) {
      nodes {
        id
        name
        level
        childrenIds
        parentId
      }
    }
  }
}`,
    categories: `
query Taxonomy {
    taxonomy {
        categories(first: 250) {
            nodes {
                ancestorIds
                childrenIds
                fullName
                id
                isArchived
                isLeaf
                isRoot
                level
                name
                parentId
            }
        }
    }
}`,
    searchCategory: `
query Taxonomy {
    taxonomy {
        categories(first: 250, search: "param_key") {
            nodes {
                ancestorIds
                childrenIds
                fullName
                id
                isArchived
                isLeaf
                isRoot
                level
                name
                parentId
            }
        }
    }
}
`,
    barcodesBySkus: `
query FetchVariantBarcodes($after: String) {
    productVariants(
      first: 250
      after: $after
      query: "@skus_placeholder"
    ) {
      pageInfo { hasNextPage endCursor }
      edges {
        node { id sku barcode }
      }
    }
  }
`
}