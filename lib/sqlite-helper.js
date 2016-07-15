'use strict';

let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    SQL = require('sql.js'),
    _ = require('lodash');

/**
 * A sqlite database helper
 * @param schemaPath
 * @param dbPath
 * @returns {{query: *, save: (function(this:null))}}
 */
function helper (schemaPath, dbPath) {

    let dbFilePath = dbPath,
        dbDirPath = path.dirname(dbFilePath),
        sql;
    
    function saveDB (sql) {
        let data = sql.export();
        let buffer = new Buffer(data);

        mkdirp.sync(dbDirPath, '0755');
        fs.writeFileSync(dbFilePath, buffer);
    }

    function parameterize (query, params) {
        if(params) {
            if (params.constructor === Array) {
                _.forEach(params, function(value, index) {
                    if(value === undefined) throw new Error('The sql parameter at position ' + index + ' is undefined');
                    query = _.replace(query, '?', value);
                });
            } else if (typeof params === 'object') {
                params = _.mapKeys(params, function (value, key) {
                    return ':' + _.trimStart(key, ':');
                });
                _.each(params, function (value, key) {
                    if(value === undefined) throw new Error('The sql parameter at position ' + key + ' is undefined');
                    query = _.replace(query, new RegExp(key, 'g'), (value === undefined ? 'NULL' : value));
                });
            }
        }
        return query;
    }

    function query (query, params) {
        return sql.exec.bind(sql)(parameterize(query, params));
    }

    function run(query, params) {
        return sql.run.bind(sql)(parameterize(query, params));
    }

    if (!fs.existsSync(dbFilePath)) {
        let schema = fs.readFileSync(schemaPath);

        sql = new SQL.Database();
        sql.run(schema);

        saveDB(sql);
    } else {
        let buffer = fs.readFileSync(dbFilePath);

        sql = new SQL.Database(buffer);
    }
    
    return {query: query, save: saveDB.bind(null, sql), run: run};
}

module.exports = helper;
