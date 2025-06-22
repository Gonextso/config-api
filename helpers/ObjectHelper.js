export default class ObjectHelper {
    static deepMerge = (target, source) => {
        for (const key in source) {
            if (key === 'password' || key === 'apiKey') {
                continue;
            }

            if (
                source[key] &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key])
            ) {
                if (
                    !target[key] ||
                    typeof target[key] !== 'object' ||
                    Array.isArray(target[key])
                ) {
                    target[key] = {};
                }
                ObjectHelper.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }

        return target;
    }

    static isEmpty = (obj) => {
        return Object.keys(obj).length === 0 && obj.constructor === Object;
    }
}