import { enrichDataset, HubSite } from "./enrich-dataset";
import * as _ from 'lodash';

jest.mock("@esri/hub-search");

describe('enrichDataset function', () => {

    const hubsite: HubSite = {
        siteUrl: 'arcgis.com',
        portalUrl: 'portal.arcgis.com'
    }

    it('should return json objet with enriced fields approriately', async () => {
        const hubDataset = {
            owner: 'fpgis.CALFIRE',
            created: 1570747289000,
            modified: 1570747379000,
            tags: ['Uno', 'Dos', 'Tres'],
            extent: {
                coordinates: [
                    [-123.8832, 35.0024],
                    [-118.3281, 42.0122],
                ],
                type: 'envelope',
            },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '0_0',
            type: 'Feature Layer',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: {
                geometryType: 'esriGeometryPolygon',
            },
            server: {
                spatialReference: {
                    latestWkid: 3310,
                    wkid: 3310,
                },
            },
            identifier: 'CALFIRE::DCAT_Test',
            slug: 'CALFIRE::DCAT_Test'
        };


        const expectedEnrichedData = {
            owner: 'fpgis.CALFIRE',
            created: 1570747289000,
            modified: 1570747379000,
            tags: ['Uno', 'Dos', 'Tres'],
            extent: { coordinates: [[-123.8832, 35.0024], [-118.3281, 42.0122]], type: 'envelope' },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '0_0',
            type: 'Feature Layer',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: { geometryType: 'esriGeometryPolygon' },
            server: { spatialReference: { latestWkid: 3310, wkid: 3310 } },
            identifier: 'CALFIRE::DCAT_Test',
            slug: 'CALFIRE::DCAT_Test',
            hubLandingPage: 'https://arcgis.com//maps/CALFIRE::DCAT_Test',
            downloadLink: 'https://arcgis.com/CALFIRE::DCAT_Test',
            agoLandingPage: 'portal.arcgis.com/home/item.html?id=0&sublayer=0',
            license: '',
            isProxiedCSV: false,
            isLayer: true,
            accessUrlGeoJSON: 'https://arcgis.com/CALFIRE::DCAT_Test.geojson?outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D',
            accessUrlKML: 'https://arcgis.com/CALFIRE::DCAT_Test.kml?outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D',
            accessUrlShapeFile: 'https://arcgis.com/CALFIRE::DCAT_Test.zip?outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D'
        }
        const enrichedDataset = enrichDataset(hubDataset, hubsite);
        expect(enrichedDataset).toStrictEqual(expectedEnrichedData);
    })

    it('Hub Page gets default keyword when no tags', async () => {
        const datasetWithNoTags = {
            owner: 'fpgis.CALFIRE',
            type: 'Hub Page',
            typeKeywords: [
                'Hub',
                'hubPage',
                'JavaScript',
                'Map',
                'Mapping Site',
                'Online Map',
                'OpenData',
                'selfConfigured',
                'Web Map',
            ],
            created: 1570747289000,
            modified: 1570747379000,
            extent: {
                coordinates: [
                    [-123.8832, 35.0024],
                    [-118.3281, 42.0122],
                ],
                type: 'envelope',
            },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '0_0',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: {
                geometryType: 'esriGeometryPolygon',
            },
            server: {
                spatialReference: {
                    wkid: 3310,
                },
            },
            licenseInfo: 'licenseInfo text',
        };
        const expectedKeyword = 'ArcGIS Hub page';
        const enrichedDataset = enrichDataset(datasetWithNoTags, hubsite);
        expect(
            enrichedDataset.keyword[0],
        ).toBe(expectedKeyword);
    })

    it('should not generate GeoJSON, KML, Shapefile access layer for non layer items', () => {
        const dataset = {
            owner: 'fpgis.CALFIRE',
            created: 1570747289000,
            modified: 1570747379000,
            tags: ['Uno', 'Dos', 'Tres'],
            extent: {
                coordinates: [
                    [-123.8832, 35.0024],
                    [-118.3281, 42.0122],
                ],
                type: 'envelope',
            },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '00',
            type: 'Feature Layer',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: {
                geometryType: 'esriGeometryPolygon',
            },
            server: {},
            identifier: 'CALFIRE::DCAT_Test',
            slug: 'CALFIRE::DCAT_Test'
        };

        const enrichedDataset = enrichDataset(dataset, hubsite);
        expect(enrichedDataset.accessUrlGeoJSON).toBeUndefined();
        expect(enrichedDataset.accessUrlKML).toBeUndefined();
        expect(enrichedDataset.accessUrlShapeFile).toBeUndefined();
    });


    it('should not return KML, Shapefile if geometryType does not exits in layer', () => {
        const dataset = {
            owner: 'fpgis.CALFIRE',
            created: 1570747289000,
            modified: 1570747379000,
            tags: ['Uno', 'Dos', 'Tres'],
            extent: {
                coordinates: [
                    [-123.8832, 35.0024],
                    [-118.3281, 42.0122],
                ],
                type: 'envelope',
            },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '0_0',
            type: 'Feature Layer',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            server: {},
            identifier: 'CALFIRE::DCAT_Test',
            slug: 'CALFIRE::DCAT_Test'
        };

        const enrichedDataset = enrichDataset(dataset, hubsite);

        expect(enrichedDataset.accessUrlKML).toBeUndefined();
        expect(enrichedDataset.accessUrlShapeFile).toBeUndefined();
    });


    it('gets WFS and WMS access url if supported', () => {
        const hubDataset = {
          id: 'foo', // non-layer id
          url: 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/rest/services/Tahoe_Things/FeatureServer/0'
        };

        const enrichedDatasetWithWFS = enrichDataset({ ...hubDataset, supportedExtensions: 'WFSServer' }, hubsite);
        const expectedWFSDistribution = 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/services/Tahoe_Things/FeatureServer/WFSServer?request=GetCapabilities&service=WFS';
        expect(enrichedDatasetWithWFS.accessUrlWFS).toEqual(expectedWFSDistribution);

        const enrichedDatasetWithWMS= enrichDataset({ ...hubDataset, supportedExtensions: 'WMSServer' }, hubsite);
        const expectedWMSDistribution = 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/services/Tahoe_Things/FeatureServer/WMSServer?request=GetCapabilities&service=WMS';
        expect(enrichedDatasetWithWMS.accessUrlWMS).toEqual(expectedWMSDistribution);

        const enrichedDataset = enrichDataset({ ...hubDataset, supportedExtensions: 'WMSServer,WFSServer' }, hubsite);
        expect(enrichedDataset.accessUrlWMS).toEqual(expectedWMSDistribution);
        expect(enrichedDataset.accessUrlWFS).toEqual(expectedWFSDistribution);

      });

      it('should get csv access url if dataset is a proxied csv', () => {
        const hubDataset = {
          id: 'foo',
          access: 'public',
          slug: 'nissan::skyline-gtr',
          size: 1,
          type: 'CSV'
        };
    
        const enrichedDataset = enrichDataset(hubDataset, hubsite);
        expect(enrichedDataset.accessUrlCSV).toBe('https://arcgis.com/nissan::skyline-gtr.csv');
        expect(enrichedDataset.isProxiedCSV).toBe(true);

      });

      it('should get csv access url if dataset is a proxied csv', () => {
        const hubDataset = {
          id: 'foo',
          access: 'public',
          slug: 'nissan::skyline-gtr',
          size: 1,
          type: 'CSV'
        };
    
        const enrichedDataset = enrichDataset(hubDataset, hubsite);
        expect(enrichedDataset.accessUrlCSV).toBe('https://arcgis.com/nissan::skyline-gtr.csv');
        expect(enrichedDataset.isProxiedCSV).toBe(true);

      });

      it('constructs landing page and download link url with protocol even if the site url only contains hostname', () => {
        const hubDataset = {
          id: 'foo',
          access: 'public',
          slug: 'nissan::skyline-gtr',
          size: 1,
          type: 'CSV'
        };
    
        const enrichedDataset = enrichDataset(hubDataset, {siteUrl: 'arcgis.com', portalUrl: 'portal.com'});
        expect(enrichedDataset.hubLandingPage).toBe('https://arcgis.com//datasets/nissan::skyline-gtr')
        expect(enrichedDataset.downloadLink).toBe('https://arcgis.com/nissan::skyline-gtr')

      });
    



})