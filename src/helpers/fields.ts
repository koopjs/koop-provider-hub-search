export const REQUIRED_FIELDS = [
  'id', // used for the dataset landing page URL
  'type', // used for the dataset landing page URL
  'slug', // used for the dataset landing page URL
  'access', // used for detecting proxied csv's
  'size', // used for detecting proxied csv's
  'licenseInfo', // required for license resolution
  'structuredLicense', // required for license resolution
  'boundary', // required for geojson
];

// additional fields due to dataset enrichment
export const ADDON_FIELDS = [
  'hubLandingPage',
  'accessUrlCSV',
  'isLayer',
  'accessUrlKML',
  'accessUrlShapeFile',
  'accessUrlWFS',
  'accessUrlWMS',
  'accessUrlGeoJSON',
  'license',
  'agoLandingPage',
  'ownerUri',
  'language',
  'keyword',
  'issuedDateTime',
  'orgTitle',
  'provenance',
  'downloadLink'
];
