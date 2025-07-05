export default {
    SUCCESS: {
        code: 200,
        message: 'Request succesfully returned'
    },
    CREATED: {
        code: 201,
        message: 'Entity created'
    },
    ACCEPTED: {
        code: 202,
        message: 'Request accepted'
    },
    NO_ENTITY: {
        code: 204,
        message: 'Request was success but returned with no entity'
    },
    BAD_REQUEST: {
        code: 400,
        message: 'Bad request. Please check your request'
    },
    NOT_AUTHENTICATED: {
        code: 401,
        message: 'You are not authenticated'
    },
    PAYMENT_REQUIRED: {
        code: 402,
        message: 'Payment required'
    },
    UNAUTHORIZED: {
        code: 403,
        message: 'You are unauthorized'
    },
    NOT_FOUND: {
        code: 404,
        message: 'Requested url not found'
    },
    CONFLICT: {
        code: 409,
        message: 'There was a conflict via identifiers in your request'
    },
    UNPROCESSABLE_ENTITY: {
        code: 422,
        message: 'This entity is unprocessable'
    },
    SERVER_ERROR: {
        code: 500,
        message: 'An error occured'
    },
    BAD_GATEWAY: {
        code: 503,
        message: 'There was an upstream error'
    }
}