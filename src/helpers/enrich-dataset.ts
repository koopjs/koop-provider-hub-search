import { DatasetResource, datasetToContent, getContentSiteUrls, IModel, parseDatasetId } from '@esri/hub-common';

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

    return {
        hubLandingPage,
        downloadLink,
        agoLandingPage,
        ...dataset
    };
};