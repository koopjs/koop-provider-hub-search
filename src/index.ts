import { HubApiModel } from "./model";
import { version } from '../package.json';

export = {
    name: 'koop-provider-hub-search',
    type: 'provider',
    disableIdParam: true,
    Model: HubApiModel,
    version
}