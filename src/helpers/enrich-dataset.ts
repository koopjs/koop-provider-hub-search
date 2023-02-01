import { IItem } from '@esri/arcgis-rest-portal';
import { DatasetResource, datasetToItem, datasetToContent, getProxyUrl, getContentSiteUrls, IHubRequestOptions, IModel, parseDatasetId } from '@esri/hub-common';
import { isPage } from '@esri/hub-sites';
import * as _ from 'lodash';
const WFS_SERVER = 'WFSServer';
const WMS_SERVER = 'WMSServer';

type HubDataset = Record<string, any>;
export const enrichDataset = (
    dataset: HubDataset,
    siteUrl: string,
    portalUrl: string,
    siteModel: IModel): HubDataset => {
    // Download and Hub Links must be generated from Content
    const content = datasetToContent({
        id: dataset.id,
        attributes: dataset
    } as DatasetResource);

    const { relative: relativePath } = getContentSiteUrls(content, siteModel);
    const hubLandingPage = siteUrl.startsWith('https://') ? siteUrl + relativePath : `https://${siteUrl}${relativePath}`;
    const downloadLink = siteUrl.startsWith('https://') ? `${siteUrl}/datasets/${content.identifier}` : `https://${siteUrl}/datasets/${content.identifier}`;
    
    // AGO links must be generated from Dataset Records
    const { itemId, layerId } = parseDatasetId(dataset.id);
    let agoLandingPage = `${portalUrl}/home/item.html?id=${itemId}`;
    if (layerId) {
        agoLandingPage += `&sublayer=${layerId}`;
    }

    const {
        structuredLicense: { url = null } = {},
        licenseInfo = ''
    } = dataset;

    // Override hub.js default license value of 'none'
    if (dataset.license === 'none') {
        dataset.license = null;
    }

    if (!dataset.license || dataset.license.match(/{{.+}}/g)?.length) {
        dataset.license = url || licenseInfo || '';
    }

    if (isPage(dataset as IItem) && !hasTags(dataset)) {
        dataset.keyword = ['ArcGIS Hub page'];
    }

    const downloadLinkFor: (type: string) => string = getDownloadLinkFn(downloadLink, dataset);
    dataset.isProxiedCSV = isProxiedCSV(dataset);
    dataset.isLayer = isLayer(dataset);
    if (isProxiedCSV(dataset)) {
        dataset.accessUrlCSV = downloadLinkFor('csv');
    }

    if (isLayer(dataset)) {
        dataset.accessUrlGeoJSON = downloadLinkFor('geojson');
        if (_.has(dataset, 'layer.geometryType')) {
            dataset.accessUrlKML = downloadLinkFor('kml');
            dataset.accessUrlShapeFile = downloadLinkFor('zip');
        }
    }

    if (dataset.supportedExtensions?.includes(WFS_SERVER)) {
        dataset.accessUrlWFS = ogcUrl(url, 'WFS');
    }

    if (dataset.supportedExtensions?.includes(WMS_SERVER)) {
        dataset.accessUrlWMS = ogcUrl(url, 'WMS');
    }

    return {
        hubLandingPage,
        downloadLink,
        agoLandingPage,
        ...dataset
    };
};

function hasTags(hubDataset: HubDataset) {
    const maybeTags = hubDataset.tags;
    return !!maybeTags && !(/{{.+}}/.test(maybeTags) || maybeTags.length === 0 || maybeTags[0] === '');
}

function isLayer(hubDataset: HubDataset) {
    return /_/.test(hubDataset.id);
}

function isProxiedCSV(hubDataset: HubDataset) {
    const item = datasetToItem({
        id: hubDataset.id,
        attributes: hubDataset
    } as DatasetResource);
    const requestOptions: IHubRequestOptions = { isPortal: false };

    return !!getProxyUrl(item, requestOptions);
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