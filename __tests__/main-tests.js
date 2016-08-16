'use strict';

jest.unmock('../lib/utils');
jest.unmock('rimraf');
jest.unmock('../lib/main');

var rimraf = require('rimraf');

const config = {
    dbPath: './out/test.client.sqlite',
    resDir: './out/test.res.client/',
    catalogUrl: 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
};

describe('Client', () => {
    var client, request;

    beforeEach(() => {
        rimraf.sync(config.dbPath);
        rimraf.sync(config.resDir);
        var Client = require('../');
        client = new Client(config.dbPath, config.resDir);
    });

    it('should download the catalog', () => {
        request = require('../lib/request');
        request.__setStatusCode = 200;
        request.__queueResponse = JSON.stringify([
            {
                date_modified: "20160728",
                lang_catalog: "https://api.unfoldingword.org/ts/txt/2/obs/languages.json?date_modified=20160728",
                meta: [ ],
                slug: "obs",
                sort: "01"
            }
        ]);
        request.__queueResponse = JSON.stringify([
            {
                language: {
                    date_modified: "20150826",
                    direction: "ltr",
                    name: "English",
                    slug: "en"
                },
                project: {
                    desc: "unfoldingWord | Open Bible Stories",
                    meta: [ ],
                    name: "Open Bible Stories"
                },
                res_catalog: "https://api.unfoldingword.org/ts/txt/2/obs/en/resources.json?date_modified=20150924"
            }
        ]);
        request.__queueResponse = JSON.stringify([
            {
                checking_questions: "https://api.unfoldingword.org/obs/txt/1/en/CQ-en.json?date_modified=20150924",
                date_modified: "20150924",
                name: "Open Bible Stories",
                notes: "https://api.unfoldingword.org/obs/txt/1/en/tN-en.json?date_modified=20150924",
                slug: "obs",
                source: "https://api.unfoldingword.org/obs/txt/1/en/obs-en.json?date_modified=20150826",
                status: {
                    checking_entity: "Distant Shores Media; Wycliffe Associates",
                    checking_level: "3",
                    comments: "Original source text.",
                    contributors: "Distant Shores Media",
                    publish_date: "2015-08-26",
                    source_text: "en",
                    source_text_version: "4",
                    version: "4"
                },
                terms: "https://api.unfoldingword.org/obs/txt/1/en/kt-en.json?date_modified=20150924",
                tw_cat: "https://api.unfoldingword.org/obs/txt/1/en/tw_cat-en.json?date_modified=20150924"
            }
        ]);
        client.updateIndex(config.catalogUrl).then((success) => {
            expect(success).toEqual(true);
            // TODO: expect that index methods have been called.
        });
    });

    it('should download a resource container', () => {

    });


});