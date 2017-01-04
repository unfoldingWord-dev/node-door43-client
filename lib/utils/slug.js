'use strict';

module.exports = {
    /**
     * NOTE: this method was taken from the resource-container module where it is thoroughly tested.
     *
     * Pads a slug to 2 significant digits.
     * Examples:
     * '1'    -> '01'
     * '001'  -> '01'
     * '12'   -> '12'
     * '123'  -> '123'
     * '0123' -> '123'
     * Words are not padded:
     * 'a' -> 'a'
     * '0word' -> '0word'
     * And as a matter of consistency:
     * '0'  -> '00'
     * '00' -> '00'
     *
     * @param slug {string} the slug that wil be padded
     * @param num_chars {int} the number of 0's to pad the slug with. Default is 2
     * @returns {*}
     */
    pad: function(slug, num_chars=2) {
        if(typeof slug !== 'string') throw new Error('slug must be a string');
        if(slug === '') throw new Error('slug cannot be an empty string');
        if(isNaN(Number(slug))) return slug;
        slug = slug.replace(/^(0+)/, '').trim();
        while(slug.length < num_chars) {
            slug = '0' + slug;
        }
        return slug;
    }
};