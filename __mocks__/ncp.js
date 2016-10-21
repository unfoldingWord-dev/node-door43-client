'use strict';
let fs = require('fs');

module.exports.ncp = jest.fn(function(path, dest, callback) {
    try {
        fs.__deepCopy(path, dest);
        callback();
    } catch (err) {
        callback(err);
    }
});