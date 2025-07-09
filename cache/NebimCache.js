import CoreCache from "../core/CoreCache.js";
import CacheFields from "../enums/CacheFields.js";
import StringHelper from "../helpers/StringHelper.js";

export default class NebimCache extends CoreCache {
    constructor(tenant) {
        super(tenant);
    }

    findAddressCode = async ({city, district}) => {
        const allAddressCodes = await this.get(CacheFields.NEBIM.ADDRESS_CODES) ?? [];
        this.logger.info(`${allAddressCodes.length} addresses fetched from cache`);

        return allAddressCodes.filter(x => 
            StringHelper.compareStrings(x.DistrictDescription, district) && 
            StringHelper.compareStrings(x.CityDescription, city))[0];
    }
}