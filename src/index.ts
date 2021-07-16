import { HubApiModel } from "./model";
import { RegistrationOptions } from "./types";

export default function register (options: RegistrationOptions = {
  defaultSiteUrl: 'https://hub.arcgis.com'
}) {
  return {
    name: 'hub-search-api-provider',
    type: 'provider',
    disableIdParam: true,
    Model: HubApiModel,
    version: require('../package.json').version,

    // Configurable Properties
    defaultSiteUrl: options.defaultSiteUrl
  };
}