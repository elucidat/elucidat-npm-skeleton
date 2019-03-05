/**
 * Elucidat NPM Skeleton
 *
 * A skeleton setup for an NPM package that facilitates the usage of OpenAPI
 * specification files and GraphQL schema for a Gateway API service.
 *
 * @version 1.0.0
 * @link https://github.com/elucidat/elucidat-npm-skeleton
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { mergeSchemas } = require('graphql-tools');
const { createGraphQlSchema } = require('oasgraph');

/**
 * Class OasSpecifications
 *
 * This class allows us to list and retrieve the OAS structures that are in the
 * `specifications` directory, get the server address for the specific service
 * based on our environment, and convert all of the specifications into one
 * large GraphQL structure.
 */
class OasSpecifications {
    constructor() {
        this.oasPath = `${__dirname}/specifications`;
        this.oasInfo = {};
        this.oasFilename = {};

        this.oasSpecs = {};
        const files = fs.readdirSync(this.oasPath);
        for (let i = 0; i < files.length; i++) {
            /*
             * We store our file named such as `<service role>-service.json`,
             * eg, `screengrab-service.json`, so split that up and use the
             * first part as the identifier.
             */
            let oasKey = files[i].split('-')[0];
            this.oasSpecs[oasKey] = require(path.resolve(this.oasPath, files[i]));
            this.oasFilename[oasKey] = files[i];
        }
    }

    /**
     * Gets a list of available OAS structures together with any set
     * info details.
     *
     * @returns {{}|*}
     */
    available() {
        if (!(Object.keys(this.oasInfo).length === 0 && this.oasInfo.constructor === Object)) {
            return this.oasInfo;
        }
        for (let oasKey in this.oasSpecs) {
            if (this.oasSpecs[oasKey].hasOwnProperty("info")) {
                this.oasInfo[oasKey] = this.oasSpecs[oasKey].info;
            } else {
                this.oasInfo[oasKey] = {}
            }
            this.oasInfo[oasKey].filename = this.oasFilename[oasKey];
        }
        return this.oasInfo;
    }

    /**
     * Get a specific OAS json structure
     *
     * @param String name
     * @returns JSON|null
     */
    specification(name) {
        return (this.oasSpecs.hasOwnProperty(name)
            ? this.oasSpecs[name]
            : null
        );
    }

    /**
     * Get the base server url for the specification given.
     *
     * It will use either the passed 'env' value, or the NODE_ENV environment
     * variable if you don't pass in a value, to determine what url you want
     * based on the description.  The description it looks for is assumed to
     * be of the format 'env:production', 'env:development', 'env:staging',
     * and so on.
     *
     * Should no matching description be found then it will return the first
     * server entry in the list.
     *
     * @param String name
     * @param String env
     * @returns null|String
     */
    baseUrl(name, env = null) {
        if (!this.oasSpecs.hasOwnProperty(name) || !this.oasSpecs[name].hasOwnProperty('servers')) {
            return null;
        }

        let servers = this.oasSpecs[name].servers;

        // Search for the url based on the description and the given environment,
        // such as 'env:production', 'env:development', 'env:staging'
        let desc = 'env:' + (env === null ? process.env.NODE_ENV : env);
        for (let s = 0; s < servers.length; s++) {
            if (servers[s].hasOwnProperty('description') && servers[s].description === desc) {
                return servers[s].url;
            }
        }

        // If all else fails, just grab the first server entry we have
        return servers[0].url;
    }

    /**
     * Returns a Promise which will convert all appropriate OAS structures
     * into a GraphQL schema.
     *
     * @param {} Any oasgraph options required
     * @returns {Promise<*>}
     * @see https://github.com/strongloop/oasgraph/tree/master/packages/oasgraph#options%7D
     */
    toGraphQL(options = {}) {
        return mergeOAS(options);
    }
}

let oas = new OasSpecifications();

/**
 * Convert an OAS structure to GraphQL
 *
 * @param spec
 * @param options
 * @returns {Promise<*>}
 */
async function convertOAStoGraphQL(spec, options = {}) {
    const { schema, report } = await createGraphQlSchema(spec, options);
    return schema;
}

/**
 * Loop through all the OAS files and convert them to GraphQL.
 *
 * This will ignore any OAS we don't want to expose to GraphQL by using the
 * `x-expose-graphql` within the specifications.
 *
 * @param options
 * @returns {Promise<Array>}
 */
async function iterateConvertOAS(options = {}) {
    let graphQlSchemas = [];
    for (let oasKey in oas.oasSpecs) {
        if (oas.oasSpecs[oasKey].hasOwnProperty('info')
            && oas.oasSpecs[oasKey].info.hasOwnProperty('x-expose-graphql')
            && oas.oasSpecs[oasKey].info['x-expose-graphql'] === false
        ) {
            continue;
        }
        
        let currentOptions = Object.assign(options, { baseUrl: oas.baseUrl(oasKey) });
        let gql = await convertOAStoGraphQL(oas.oasSpecs[oasKey], currentOptions);
        graphQlSchemas.push(gql);
    }
    return graphQlSchemas;
}

/**
 * Handle the merging of the schemas.
 *
 * @param options
 * @returns {Promise<*>}
 */
async function mergeOAS(options = {}) {
    let schemas = await iterateConvertOAS(options);
    return mergeSchemas({
        schemas
    });
}

module.exports = {
    oas
};
