import CoreClass from '../core/CoreClass.js'
import HttpRequestHelper from "../helpers/HttpRequestHelper.js";

export default class CoreAPI extends CoreClass {
    constructor() {
        super();
        this.httpRequest = new HttpRequestHelper();
    }
}