import { IItem } from '@esri/arcgis-rest-portal';
import { DatasetResource, datasetToItem, datasetToContent, getProxyUrl, IHubRequestOptions, parseDatasetId } from '@esri/hub-common';
import { isPage } from '@esri/hub-sites';
import * as geojsonRewind from 'geojson-rewind';
import * as _ from 'lodash';
const WFS_SERVER = 'WFSServer';
const WMS_SERVER = 'WMSServer';
type HubDataset = Record<string, any>;
type GeometryTypes = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
type Feature = {
    type: 'Feature',
    geometry: {
        type: GeometryTypes,
        coordinates: number[]
    },
    properties: HubDataset
}
export type HubSite = {
    siteUrl: string,
    portalUrl: string,
};

/**
 * Mapping from ElasticSearch geo_shape type
 * to valid GeoJSON type  
 */
const elasticToGeojsonType = {
    point: 'Point',
    linestring: 'LineString',
    polygon: 'Polygon',
    multipoint: 'MultiPoint',
    multilinestring: 'MultiLineString',
    multipolygon: 'MultiPolygon',
    geometrycollection: 'GeometryCollection'
};

export function enrichDataset(dataset: HubDataset, hubsite: HubSite): Feature {
    // Download and Hub Links must be generated from Content
    const content = datasetToContent({
        id: dataset.id,
        attributes: dataset
    } as DatasetResource);

    const { siteUrl, portalUrl }: HubSite = hubsite;
    const { identifier, urls: { relative } } = content;

    const additionalFields: Record<string, any> = {}; // container object for additional fields
    additionalFields.hubLandingPage = concatUrlAndPath(siteUrl, relative);
    additionalFields.downloadLink = concatUrlAndPath(siteUrl, identifier);

    additionalFields.agoLandingPage = getAgoLandingPageUrl(dataset.id, portalUrl);
    additionalFields.license = getDatasetLicense(dataset);

    if (isPage(dataset as IItem) && !hasTags(dataset)) {
        additionalFields.keyword = ['ArcGIS Hub page'];
    }

    const downloadLinkFor: (type: string) => string = getDownloadLinkFn(additionalFields.downloadLink, dataset);
    additionalFields.isProxiedCSV = isProxiedCSV(dataset);
    additionalFields.isLayer = isLayer(dataset);
    if (isProxiedCSV(dataset)) {
        additionalFields.accessUrlCSV = downloadLinkFor('csv');
    }

    if (isLayer(dataset)) {
        additionalFields.accessUrlGeoJSON = downloadLinkFor('geojson');
        if (_.has(dataset, 'layer.geometryType')) {
            additionalFields.accessUrlKML = downloadLinkFor('kml');
            additionalFields.accessUrlShapeFile = downloadLinkFor('zip');
        }
    }

    if (dataset.supportedExtensions?.includes(WFS_SERVER)) {
        additionalFields.accessUrlWFS = ogcUrl(dataset.url, 'WFS');
    }

    if (dataset.supportedExtensions?.includes(WMS_SERVER)) {
        additionalFields.accessUrlWMS = ogcUrl(dataset.url, 'WMS');
    }

    return hubDatasetToFeature({
        ...dataset,
        ...additionalFields
    });
};

function hubDatasetToFeature(hubDataset: HubDataset): Feature {
    const { type, rings } = hubDataset?.boundary?.geometry ?? {};
    // clockwise polygon rings rewind transformation 
    // is necesssary to follow right hand rule for valid geoJSON
    return geojsonRewind({
        type: 'Feature',
        geometry: {
            type: elasticToGeojsonType[type],
            coordinates: rings
        },
        properties: objectWithoutKeys(hubDataset, ['boundary'])
    }, false);
}

function hasTags(hubDataset: HubDataset) {
    const maybeTags = hubDataset.tags;
    return !!maybeTags && !(/{{.+}}/.test(maybeTags) || maybeTags.length === 0 || maybeTags[0] === '');
}

function isLayer(hubDataset: HubDataset) {
    return /_/.test(hubDataset.id);
}

function concatUrlAndPath(siteUrl: string, path: string) {
    try {
        return Boolean(new URL(siteUrl)) && `${siteUrl}/${path}`;
    } catch (e) {
        return `https://${siteUrl}/${path}`;
    }
}

function getDatasetLicense(dataset: HubDataset) {
    const {
        structuredLicense: { url = null } = {},
        licenseInfo = ''
    } = dataset;

    // Override hub.js default license value of 'none'
    const license =
        dataset.license === 'none' ?
            null :
            (!dataset.license || dataset.license.match(/{{.+}}/g)?.length)
                ? (url || licenseInfo || '') :
                dataset.license;

    return license;
}

function isProxiedCSV(hubDataset: HubDataset) {
    const item = datasetToItem({
        id: hubDataset.id,
        attributes: hubDataset
    } as DatasetResource);
    const requestOptions: IHubRequestOptions = { isPortal: false };

    return !!getProxyUrl(item, requestOptions);
}

function getAgoLandingPageUrl(datasetId: string, portalUrl: string) {
    const { itemId, layerId } = parseDatasetId(datasetId);
    let agoLandingPage = `${portalUrl}/home/item.html?id=${itemId}`;
    if (layerId) {
        agoLandingPage += `&sublayer=${layerId}`;
    }
    return agoLandingPage;
}

// HUBJS CANDIDATE
function getDownloadLinkFn(downloadLink: string, hubDataset: any) {
    const spatialReference = _.get(hubDataset, 'server.spatialReference');

    let queryStr = '';

    if (spatialReference) {
        const { latestWkid, wkid } = spatialReference;

        if (wkid) {
            const outSR = JSON.stringify({ latestWkid, wkid });
            queryStr = `?outSR=${encodeURIComponent(outSR)}`;
        }
    }

    return (ext: string) => `${downloadLink}.${ext}${queryStr}`;
}

function ogcUrl(datasetUrl: string, type: 'WMS' | 'WFS' = 'WMS') {
    return datasetUrl.replace(/rest\/services/i, 'services').replace(/\d+$/, `${type}Server?request=GetCapabilities&service=${type}`);
}

/**
 * fast approach to remove keys from an object
 * (from babel transplier)
 */
function objectWithoutKeys(obj, keys): Record<string, any> {
    return Object.keys(obj).reduce((newObject, key) => {
        if (keys.indexOf(key) === -1) newObject[key] = obj[key];
        return newObject;
    }, {});
}

