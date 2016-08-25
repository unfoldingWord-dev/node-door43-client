'use strict';

let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    SQL = require('sql.js'),
    _ = require('lodash');

/**
 * A SQLite database helper.
 *
 * @param schemaPath {string}
 * @param dbPath {string}
 * @constructor
 */
function SQLiteHelper (schemaPath, dbPath) {

    let dbFilePath = dbPath,
        dbDirPath = path.dirname(dbFilePath),
        sql;

    /**
     * Saves a sql database to the disk.
     *
     * @param sql {Database}
     */
    function saveDB (sql) {
        let data = sql.export();
        let buffer = new Buffer(data);

        mkdirp.sync(dbDirPath, '0755');
        fs.writeFileSync(dbFilePath, buffer);
    }

    /**
     * Prefixes object params with ':'.
     * If something other than an object is given the will be returned without being changed.
     *
     * @param params {[]|{}|string}
     * @returns {*} returns the updated params object
     */
    function normalizeParams(params) {
        if (params && params.constructor !== Array && typeof params === 'object') {
            params = _.mapKeys(params, function (value, key) {
                return ':' + _.trimStart(key, ':');
            });
        }
        return params;
    }

    /**
     * Executes a command returning the results.
     *
     * @param query {string} the query string
     * @param params {[]|{}} the parameters to be bound to the query
     * @returns {[]} an array of rows
     */
    function query (query, params) {
        let rows = [];
        let stmt = sql.prepare(query);
        params = normalizeParams(params);
        stmt.bind(params);
        while(stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    /**
     * Executes a command ignoring the results.
     *
     * @param query {string} the run string
     * @param params {[]|{}} the parameters to be bound to the query
     */
    function run(query, params) {
        let stmt = sql.prepare(query);
        params = normalizeParams(params);
        stmt.run(params);
        stmt.free();
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

module.exports = SQLiteHelper;
