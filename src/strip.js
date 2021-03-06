
/**
 * Remove fields from data (destructive, ie. modifies `data` directly)
 * This is mostly useful to remove `undefined` fields from data
 *
 * @param {Mixed|Mixed[]} values The value or array of values to match
 * @param {Object} data
 *
 * @memberof Format
 * @alias strip
*/

module.exports = function strip (values, data) {
  for (var k in data) {
    if (!data.hasOwnProperty(k)) continue

    if (!(values instanceof Array)) values = [values]

    values.forEach(val => data[k] === val && delete data[k])
  }
}
