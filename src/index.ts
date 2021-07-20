import { HubApiModel } from "./model";
import { version } from '../package.json';

export = {
    name: 'hub-search-api-provider',
    type: 'provider',
    disableIdParam: true,
    Model: HubApiModel,
    version
}