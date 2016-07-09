'use strict';

var utils = {
    chain: function (visit, onFail, opts) {
        var fail = onFail ? onFail : utils.ret(false),
            config = opts || { compact: true };

        return function (list) {
            var p = Promise.resolve(false),
                results = [];

            list.forEach(function (l) {
                p = p.then(visit.bind(null, l))
                    .catch(function (err) {
                        return fail(err, l);
                    })
                    .then(function (result) {
                        results.push(result);
                    });
            });

            return p.then(function () {
                return config.compact ? results.filter(Boolean) : results;
            });
        };
    },

    /**
     * Creates a function that returns the data when called.
     *  E.g.
     *      var myData = 'bob';
     *      var getData = ret(myData);
     *      getData(); // returns 'bob'
     *
     * Useful in Promises:
     *
     *  Before:
     *      var myData = 'bob';
     *
     *      somePromise.then(function (doesntMatter) {
         *          return myData;
         *      });
     *
     *  After:
     *      var myData = 'bob';
     *
     *      somePromise.then(ret(myData));
     */
    ret: function (data) {
        return function () {
            return data;
        };
    }
};

module.exports = utils;