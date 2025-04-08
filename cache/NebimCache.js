import CoreCache from "../core/CoreCache.js";
import CacheFields from "../enums/CacheFields.js";
import StringHelper from "../helpers/StringHelper.js";

export default class NebimCache extends CoreCache {
    constructor(companyName) {
        super(companyName);
    }

    findAddressCode = async ({city, district}) => {
        const allAddressCodes = await this.get(CacheFields.NEBIM.ADDRESS_CODES) ?? [];

        return allAddressCodes.filter(x => 
            StringHelper.compareStrings(x.DistrictDescription, district) && 
            StringHelper.compareStrings(x.CityDescription, city))[0];
    }
}