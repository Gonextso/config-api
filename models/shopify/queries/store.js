export default {
    stores: `
query Publications {
    publications(first: 100) {
        nodes {
            id
            name
        }
    }
}`,
    locations: `
query {
    locations(first: 15) {
        edges {
            node {
                id
                name
                address {
                    formatted
                }
                isPrimary
            }
        }
    }
}`,
    dummy: `
query Publications {
    publications(first: 1) {
    }
}`,
}