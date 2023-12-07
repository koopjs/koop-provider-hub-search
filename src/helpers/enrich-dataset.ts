import { getUserUrl, IItem } from '@esri/arcgis-rest-portal';
import {
    DatasetResource,
    datasetToItem,
    datasetToContent,
    getProxyUrl,
    IHubRequestOptions,
    parseDatasetId
} from '@esri/hub-common';
import { isPage } from '@esri/hub-sites';
import * as geojsonRewind from 'geojson-rewind';
import * as _ from 'lodash';
import { UserSession } from '@esri/arcgis-rest-auth';
import alpha2ToAlpha3Langs from './languages';

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
    orgBaseUrl: string,
    orgTitle: string
};
type FileType = 'shapefile' | 'csv' | 'geojson' | 'kml';
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
    const { siteUrl, portalUrl, orgBaseUrl, orgTitle }: HubSite = hubsite;
    const { identifier, urls: { relative } } = content;
    const additionalFields: Record<string, any> = {
        ownerUri: getUserUrl({
            portal: `${orgBaseUrl}/sharing/rest`,
            username: dataset.owner
        } as UserSession) + '?f=json',
        language: _.get(dataset, 'metadata.metadata.dataIdInfo.dataLang.languageCode.@_value') || localeToLang(dataset.culture) || '',
        keyword: getDatasetKeyword(dataset),
        issuedDateTime: _.get(dataset, 'metadata.metadata.dataIdInfo.idCitation.date.pubDate') || new Date(dataset.created).toISOString(),
        orgTitle,
        provenance: _.get(dataset, 'metadata.metadata.dataIdInfo.idCredit', ''),
        hubLandingPage: concatUrlAndPath(siteUrl, relative.slice(1)),
        downloadLink: concatUrlAndPath(siteUrl, `datasets/${identifier}`),
        agoLandingPage: getAgoLandingPageUrl(dataset.id, portalUrl),
        isLayer: isLayer(dataset),
        license: getDatasetLicense(dataset)
    };

    const downloadLinkFor: (type: string) => string = getDownloadLinkFn(additionalFields.downloadLink, dataset);

    if (isProxiedCSV(dataset)) {
        additionalFields.accessUrlCSV = downloadLinkFor('csv');
    }

    if (isLayer(dataset)) {
        additionalFields.accessUrlGeoJSON = downloadLinkFor('geojson');
        additionalFields.durableUrlGeoJSON = generateDurableDownloadUrl(dataset.id, siteUrl, 'geojson');
        additionalFields.accessUrlCSV = downloadLinkFor('csv');
        additionalFields.durableUrlCSV = generateDurableDownloadUrl(dataset.id, siteUrl, 'csv');
        if (_.has(dataset, 'layer.geometryType')) {
            additionalFields.accessUrlKML = downloadLinkFor('kml');
            additionalFields.durableUrlKML = generateDurableDownloadUrl(dataset.id, siteUrl, 'kml');
            additionalFields.accessUrlShapeFile = downloadLinkFor('zip');
            additionalFields.durableUrlShapeFile= generateDurableDownloadUrl(dataset.id, siteUrl, 'shapefile');
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

function generateDurableDownloadUrl(datasetId: string, siteUrl: string, fileType: FileType) {
    const { itemId, layerId } = parseDatasetId(datasetId);
    return `https://${siteUrl}/api/download/v1/items/${itemId}/${fileType}?layers=${layerId}`;
}

function getDatasetKeyword(dataset: HubDataset): string[] {
    const metaKeyword = _.get(dataset, 'metadata.metadata.dataIdInfo.searchKeys.keyword');

    if (metaKeyword) {
        return metaKeyword;
    }

    const { tags, type, typeKeywords } = dataset;
    const hasNoTags = !tags || tags.length === 0 || !tags[0]; // if tags is undefined, the tags array is empty, or tags is an empty string

    if (isPage({ type, typeKeywords } as IItem) && hasNoTags) {
        return ['ArcGIS Hub page'];
    }

    return tags;
}

function hubDatasetToFeature(hubDataset: HubDataset): Feature {
    const { type, rings } = hubDataset.boundary?.geometry ?? {};
    // clockwise polygon rings rewind transformation 
    // is necesssary to follow right hand rule for valid geoJSON
    return geojsonRewind({
        type: 'Feature',
        geometry: {
            type: elasticToGeojsonType[type],
            coordinates: rings
        },
        properties: hubDataset && objectWithoutKeys(hubDataset, ['boundary'])
    }, false);
}

function localeToLang(locale: string) {
    return locale ? alpha2ToAlpha3Langs[locale.split('-')[0]] : '';
}

function isLayer(hubDataset: HubDataset): boolean {
    return /_/.test(hubDataset.id);
}

function concatUrlAndPath(siteUrl: string, path: string) {
    try {
        return Boolean(new URL(siteUrl)) && `${siteUrl}/${path}`;
    } catch (e) {
        return `https://${siteUrl}/${path}`;
    }
}

function getDatasetLicense(dataset: HubDataset): string {
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

function isProxiedCSV(hubDataset: HubDataset): boolean {
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

    let queryStr = '?where=1=1'; // default query param to get up to date file

    if (spatialReference) {
        const { latestWkid, wkid } = spatialReference;

        if (wkid) {
            const outSR = JSON.stringify({ latestWkid, wkid });
            queryStr = `${queryStr}&outSR=${encodeURIComponent(outSR)}`;
        }
    }

    return (ext: string) => `${downloadLink}.${ext}${queryStr}`;
}

function ogcUrl(datasetUrl: string, type: 'WMS' | 'WFS'): string {
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