import { enrichDataset, HubSite } from "./enrich-dataset";
import * as _ from 'lodash';
import * as geojsonValidation from 'geojson-validation';

jest.mock("@esri/hub-search");

describe('enrichDataset function', () => {

    const hubsite: HubSite = {
        siteUrl: 'arcgis.com',
        portalUrl: 'portal.arcgis.com',
        orgBaseUrl: 'qa.arcgis.com',
        orgTitle: "QA Premium Alpha Hub"
    }

    it('should return geojson with enriched fields in properties field', async () => {
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
            id: '123a_0',
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


        const expectedEnrichedProperties = {
            owner: 'fpgis.CALFIRE',
            created: 1570747289000,
            modified: 1570747379000,
            tags: ['Uno', 'Dos', 'Tres'],
            extent: { coordinates: [[-123.8832, 35.0024], [-118.3281, 42.0122]], type: 'envelope' },
            name: 'DCAT_Test',
            description: 'Some Description',
            source: 'Test Source',
            id: '123a_0',
            type: 'Feature Layer',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: { geometryType: 'esriGeometryPolygon' },
            server: { spatialReference: { latestWkid: 3310, wkid: 3310 } },
            identifier: 'CALFIRE::DCAT_Test',
            slug: 'CALFIRE::DCAT_Test',
            ownerUri: 'qa.arcgis.com/sharing/rest/community/users/fpgis.CALFIRE?f=json',
            language: '',
            keyword: ['Uno', 'Dos', 'Tres'],
            issuedDateTime: '2019-10-10T22:41:29.000Z',
            orgTitle: 'QA Premium Alpha Hub',
            provenance: '',
            hubLandingPage: 'https://arcgis.com/maps/CALFIRE::DCAT_Test',
            downloadLink: 'https://arcgis.com/datasets/CALFIRE::DCAT_Test',
            durableUrlCSV: 'https://arcgis.com/api/download/v1/items/123a/csv?layers=0',
            durableUrlGeoJSON: 'https://arcgis.com/api/download/v1/items/123a/geojson?layers=0',
            durableUrlShapeFile: 'https://arcgis.com/api/download/v1/items/123a/shapefile?layers=0',
            durableUrlKML: 'https://arcgis.com/api/download/v1/items/123a/kml?layers=0',
            agoLandingPage: 'portal.arcgis.com/home/item.html?id=123a&sublayer=0',
            isLayer: true,
            license: '',
            accessUrlGeoJSON: 'https://arcgis.com/datasets/CALFIRE::DCAT_Test.geojson?where=1=1&outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D',
            accessUrlCSV: 'https://arcgis.com/datasets/CALFIRE::DCAT_Test.csv?where=1=1&outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D',
            accessUrlKML: 'https://arcgis.com/datasets/CALFIRE::DCAT_Test.kml?where=1=1&outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D',
            accessUrlShapeFile: 'https://arcgis.com/datasets/CALFIRE::DCAT_Test.zip?where=1=1&outSR=%7B%22latestWkid%22%3A3310%2C%22wkid%22%3A3310%7D'
        }

        const enrichedDataset = enrichDataset(hubDataset, hubsite);
        expect(enrichedDataset.properties).toBeDefined();

        expect(enrichedDataset.properties).toStrictEqual(expectedEnrichedProperties);
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
            enrichedDataset.properties?.keyword[0],
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

        expect(enrichedDataset.properties.accessUrlGeoJSON).toBeUndefined();
        expect(enrichedDataset.properties.accessUrlKML).toBeUndefined();
        expect(enrichedDataset.properties.accessUrlShapeFile).toBeUndefined();
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

        expect(enrichedDataset.properties.accessUrlKML).toBeUndefined();
        expect(enrichedDataset.properties.accessUrlShapeFile).toBeUndefined();
    });


    it('gets WFS and WMS access url if supported', () => {
        const hubDataset = {
            id: 'foo', // non-layer id
            url: 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/rest/services/Tahoe_Things/FeatureServer/0',
            created: 1570747289000
        };

        const enrichedDatasetWithWFS = enrichDataset({ ...hubDataset, supportedExtensions: 'WFSServer' }, hubsite);
        const expectedWFSDistribution = 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/services/Tahoe_Things/FeatureServer/WFSServer?request=GetCapabilities&service=WFS';
        expect(enrichedDatasetWithWFS.properties.accessUrlWFS).toEqual(expectedWFSDistribution);

        const enrichedDatasetWithWMS = enrichDataset({ ...hubDataset, supportedExtensions: 'WMSServer' }, hubsite);
        const expectedWMSDistribution = 'https://servicesqa.arcgis.com/Xj56SBi2udA78cC9/arcgis/services/Tahoe_Things/FeatureServer/WMSServer?request=GetCapabilities&service=WMS';
        expect(enrichedDatasetWithWMS.properties.accessUrlWMS).toEqual(expectedWMSDistribution);

        const enrichedDataset = enrichDataset({ ...hubDataset, supportedExtensions: 'WMSServer,WFSServer' }, hubsite);
        expect(enrichedDataset.properties.accessUrlWMS).toEqual(expectedWMSDistribution);
        expect(enrichedDataset.properties.accessUrlWFS).toEqual(expectedWFSDistribution);

    });

    it('should get csv access url if dataset is a proxied csv', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.accessUrlCSV).toBe('https://arcgis.com/datasets/nissan::skyline-gtr.csv?where=1=1');

    });

    it('should alpha2 To Alpha3 language', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            culture: 'sn-sv'
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.language).toBe('sna');
    });

    it('should set license field as null if dataset license is not set', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'none'
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.license).toBe(null);
    });

    it('should generate WFS distribution url if supported', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'none',
            supportedExtensions: ['WFSServer'],
            url: 'https://sampleserver3.arcgisonline.com/arcgis/rest/services/Earthquakes/RecentEarthquakesRendered/MapServer/0',
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.accessUrlWFS).toBe('https://sampleserver3.arcgisonline.com/arcgis/services/Earthquakes/RecentEarthquakesRendered/MapServer/WFSServer?request=GetCapabilities&service=WFS');
    });

    it('should generate WMS distribution url if supported', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'none',
            supportedExtensions: ['WMSServer'],
            url: 'https://sampleserver3.arcgisonline.com/arcgis/rest/services/Earthquakes/RecentEarthquakesRendered/MapServer/0',
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.accessUrlWMS).toBe('https://sampleserver3.arcgisonline.com/arcgis/services/Earthquakes/RecentEarthquakesRendered/MapServer/WMSServer?request=GetCapabilities&service=WMS');
    });



    it('should generate download link without query string if wkid is not present in spatialReference', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'none',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: {
                geometryType: 'esriGeometryPolygon',
            },
            server: {
                spatialReference: {
                    latestWkid: 3310,
                },
            },
            identifier: 'CALFIRE::DCAT_Test',
            supportedExtensions: ['WMSServer']
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.accessUrlWMS).toBe('https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/services/DCAT_Test/FeatureServer/WMSServer?request=GetCapabilities&service=WMS');
    });
    

    it('should generate download link without query string if wkid is not present in spatialReference', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'none',
            url: 'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/DCAT_Test/FeatureServer/0',
            layer: {
                geometryType: 'esriGeometryPolygon',
            },
            server: {
                spatialReference: {
                    latestWkid: 3310,
                },
            },
            identifier: 'CALFIRE::DCAT_Test',
            supportedExtensions: ['WMSServer'],
            boundary: {
                geometry: {
                    type: 'sd'
                }
            }
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.accessUrlWMS).toBe('https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/services/DCAT_Test/FeatureServer/WMSServer?request=GetCapabilities&service=WMS');
    });

    it('should return structuredLicense url if dataset contains uninterpolated string', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: '{{customLicense}}',
            structuredLicense: { url: 'arcgis.com' }
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.license).toBe('arcgis.com');
    });

    it('should return custom license if avaiable', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            license: 'customLicense',
            url: 'arcgis.com'
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.license).toBe('customLicense');
    });

    it('should get csv access url if dataset is a proxied csv', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000
        };

        const { properties } = enrichDataset(hubDataset,
            { siteUrl: 'https://arcgis.com', portalUrl: 'https://arcgis.portal.com', orgBaseUrl: 'qa.arcgis.com', orgTitle: "QA Premium Alpha Hub" });
        expect(properties.hubLandingPage).toBe('https://arcgis.com/datasets/nissan::skyline-gtr');
        expect(properties.downloadLink).toBe('https://arcgis.com/datasets/nissan::skyline-gtr');

    });

    it('should retrieve keywords from metadata if available', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000,
            metadata: {
                metadata: {
                    dataIdInfo: {
                        searchKeys: {
                            keyword: ['meta_keywords']
                        }
                    }
                }
            }
        };

        const { properties } = enrichDataset(hubDataset, hubsite);
        expect(properties.keyword).toStrictEqual(['meta_keywords']);

    });

    it('constructs landing page and download link url with protocol even if the site url only contains hostname', () => {
        const hubDataset = {
            id: 'foo',
            access: 'public',
            slug: 'nissan::skyline-gtr',
            size: 1,
            type: 'CSV',
            created: 1570747289000
        };

        const { properties } = enrichDataset(hubDataset,
            { siteUrl: 'arcgis.com', portalUrl: 'portal.com', orgBaseUrl: 'qa.arcgis.com', orgTitle: "QA Premium Alpha Hub" });
        expect(properties.hubLandingPage).toBe('https://arcgis.com/datasets/nissan::skyline-gtr')
        expect(properties.downloadLink).toBe('https://arcgis.com/datasets/nissan::skyline-gtr')

    });

    it('generates valid feature geojson', () => {
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
            boundary: {
                geometry: {
                    type: "polygon",
                    rings: [
                        [
                            [-77.10272947561813, 38.972065644420645],
                            [-76.92659446846153, 38.972065644420645],
                            [-76.92659446846153, 38.874986889968675],
                            [-77.10272947561813, 38.874986889968675],
                            [-77.10272947561813, 38.972065644420645]
                        ]
                    ]
                }
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
        const geojson = enrichDataset(hubDataset,
            { siteUrl: 'arcgis.com', portalUrl: 'portal.com', orgBaseUrl: 'qa.arcgis.com', orgTitle: "QA Premium Alpha Hub" });

        expect(geojson.geometry).toBeDefined();
        expect(geojson.geometry.type).toBe('Polygon');
        expect(geojson.geometry.coordinates).toStrictEqual([
            [
                [-77.10272947561813, 38.972065644420645],
                [-77.10272947561813, 38.874986889968675],
                [-76.92659446846153, 38.874986889968675],
                [-76.92659446846153, 38.972065644420645],
                [-77.10272947561813, 38.972065644420645]
            ]
        ]
        );
        expect(geojson.type).toBe('Feature');
        expect(geojson.properties).toBeDefined();
        expect(geojsonValidation.isFeature(geojson)).toBe(true);
    });
}) 