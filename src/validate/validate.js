
/**
 * Module dependencies
 * @ignore
 */

const is = require('../is')
const Rules = require('../rules')
const setDefault = require('../default')
const checkValue = require('./checkValue')

/**
 * Expose the module
 * @ignore
 */

module.exports = {validate, checkValue}

/**
 * Validates `data` against a model's rules.
 *
 * If passed "opts" `{sparse:true}`, validation is only run on the fields in
 * the data objected provided. Default is `false`, so validation is run on
 * all fields in the provided `model`
 *
 * If passed "opts" `{strict: true}`, validation ensures all keys on the data
 * payload are valid (ie. have an associated model field), before running
 * normal validation
 *
 * Returns:
 *
 * ```
 * {
 *  valid: {Boolean},
 *  // Error object if data is object, array if scalar
 *  errors: {Object|Array}
 * }
 * ```
 *
 * Example:
 *
 * ```
 * validate({type:'string'}, '1')
 * // -> {valid:true, errors:[]}
 *
 * validate({name:{type:'string'}}, {name:'Zim'})
 * // -> {valid: true, errors:{}}
 * ```
 *
 * @param {Model} model The data structure rules used for validation
 * @param {Object} [opts] Optional options `{sparse:true}` to only parse data keys
 * @param {Object|Mixed} data The data item to validate
 *
 * @returns {Object} Validation object `{valid:$bool, errors:$Object|Array}`
 *
 * @memberof Skematic
 * @alias validate
 */

function validate (model, data, opts = {}) {
  if (opts.keyCheckOnly) return _checkKeys(model, data)

  // Strict checks that the data keys are valid AND runs normal validation if so
  if (opts.strict) {
    const checkedKeys = _checkKeys(model, data)
    if (!checkedKeys.valid) return checkedKeys
  }

  if (opts.sparse) return _sparse(data, model, opts)
  else return _validate(data, model, opts)
}

/**
 * Checks that the keys on the data object
 *
 * @param {Model} model The data structure rules used for validation
 * @param {Object|Mixed} data The data item to validate
 *
 * @returns {Object} Validation object `{valid:$bool, errors:$Object|Array}`
 * @private
 */

function _checkKeys (model, data) {
  let ret = {
    valid: true,
    errors: {}
  }

  if (!is.object(data)) {
    return {valid: false, errors: {data: ['invalidObject']}}
  }

  const MAX_USER_KEY_LEN = 48
  for (let key in data) {
    if (!model[key]) {
      ret.valid = false

      // Sanitize user keylength
      const shortKey = key.length > MAX_USER_KEY_LEN
        ? key.substr(0, MAX_USER_KEY_LEN - 3) + '...'
        : key

      ret.errors[shortKey] = [`invalidKey`]
    }
  }

  return ret
}

/**
 * Internal method that handles the validation of arbitrary `data`.
 *
 * @param {Mixed} data Either a scalar, array or object to validate
 * @param {Model} model The data structure to use for validation rules
 * @param {Options} opts Validation options
 * @param {Object} [parentData] Optional parent data object
 *
 * @returns {Object} `{valid:bool, errors:hash|array}`
 * @private
 */

function _validate (data, model, opts, parentData = {}) {
  let errs = {}

  // Validate scalars
  // Used by `_sparse()` to check scalar vals -- pass parentObj if exists
  // so that rules that check `this` data don't get null.
  if (!is.object(data)) {
    let res = checkValue(data, model, parentData, opts)
    return res.length
      ? {valid: false, errors: res}
      : {valid: true, errors: null}
  }

  // Step through ONLY our model keys
  // (Note: sparse validation of known keys happens in `_sparse()`)
  for (let key in model) {
    // Shorthand model reference
    let scm = model[key]
    // Only handle own properties
    if (!scm) continue

    // Shorthand
    let v = data[key]

    // If it's not required and the default value is 'empty', skip it
    // UNLESS it has other rules defined -- then run validation
    // Note: 'allowNull: false' is NOT NULL. Disallows empty.
    const isRequired = scm.required || scm.allowNull === false
    const hasRules = !!Object.keys(scm.rules || {}).length
    const hasEmptyDefault = Rules.isEmpty(setDefault(v, scm))
    if (!hasRules && !isRequired && hasEmptyDefault) continue

    // Recursively Validate sub-model
    if (scm.model) {
      // Arrays can be either raw 'values' or complex 'objects'
      if (scm.type === 'array' || v instanceof Array) {
        // Don't attampt to process 'v' if it's not set
        if (!v) continue

        v.forEach((val, idx) => {
          // Array of complex objects
          if (is.type(val) === 'object') {
            let arsub = _validate(val, scm.model, opts)
            if (!arsub.valid) {
              if (!errs[key]) errs[key] = {}
              errs[key][idx] = arsub.errors
            }
          } else {
            // Array of simple types
            let er = checkValue(val, scm.model, data, opts)
            if (er.length) {
              if (!errs[key]) errs[key] = {}
              errs[key][idx] = er
            }
          }
        })
      } else {
        // Forces strict checking on sub-models
        const checkedKeys = _checkKeys(scm.model, v)
        if (!checkedKeys.valid) return (errs[key] = checkedKeys)

        // Otherwise just assume it's an object
        let sub = _validate(v, scm.model, opts)
        if (!sub.valid) errs[key] = sub.errors
      }

      // Otherwise NO sub-model: test the value directly
    } else {
      let errors = checkValue(v, scm, data, opts)
      if (errors.length) errs[key] = errors
    }
  }

  // Return errors:null if no errors
  if (Object.keys(errs).length < 1) errs = null

  return {
    valid: !errs,
    errors: errs
  }
}

/**
 * Validates ONLY the keys on the data object, NOT the keys on the model
 *
 * @param {Object} data The keyed data object to validate
 * @param {Model} model The model rules
 *
 * @returns {Object} Validation object `{valid:$bool, errors:$Object}`
 * @private
 */

function _sparse (data, model, opts) {
  let isValid = true
  let errs = {}
  let out

  for (let key in data) {
    // Only valid with an associated model
    if (!model[key]) continue

    out = _validate(data[key], model[key], opts, data)
    if (!out.valid) {
      isValid = false
      errs[key] = out.errors
    }
  }

  return {
    valid: isValid,
    errors: errs
  }
}
