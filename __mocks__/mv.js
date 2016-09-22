'use strict';

module.exports = jest.fn(function(source, dest, options, cb) {
    if(typeof options === 'function') {
        cb = options;
        options = {};
    }
    cb();
});