# Elucidat NPM Skeleton

A repository has the basis of an npm package which is used to hold the specifications for microservices, and allows them to be converted into GraphQL by using [oasgraph](https://github.com/strongloop/oasgraph) and [graphql-tools](https://github.com/apollographql/graphql-tools).

This repo was built with Elucidat specifically in mind, and as such we've made decisions that are suited to our needs.  We use the code by rolling this repository into another (which has our OAS files) and making that a private npm package.  You may find benefit in doing similar.  However, this repo should be sufficiently portable to whatever you may need.

You should ensure that all of your OAS files are stored within the `specifications` directory and are written in json-formatted OpenAPI (v2 or v3, with the preference being v3).

The usage of this package makes one fairly large assumption; that the `servers` section of the OAS file looks something like this:

```
"servers": [
    {
        "url": "http://127.0.0.1:8080",
        "description": "env:local"
    },
    {
        "url": "https://beta.example.com/",
        "description": "env:testing"
    },
    {
        "url": "https://app.example.com/",
        "description": "env:production"
    }
],
``` 

In that there is a `url` for the server and the `description` of the server has the format `env:<envionment value>`.  This is important in allowing a specific choice of server to use when converting the OAS to GraphQL rather than letting it default to a random selection of the server list.

When setup and included in your code, the following methods are available:

* To get a list of all the available specifications

    ```javascript
    oas.available()
    ```

* To get a single specification structure

    ```javascript
    oas.specification(specName)
    ```


* To get the base url of a spec

    ```javascript
    oas.baseUrl(specName, <environment>)
    ```

    If you don't supply an `environment` string then the system will attempt to use `process.env.NODE_ENV` as the value for the environment.  This will look for any entry in the `servers` list that has a matching `description` tag, such as `env:production` or `env:development`.


* To get all available specifications merged into a single structure

    ```javascript
    oas.toGraphQL(<options>)
    ```

    This will return a `Promise` which, when resolved, will give a combined GraphQL schema of all available OpenAPI specifications.
    
    Should you not want an OAS specification file to be included in the GraphQL schema, you can use the `x-expose-graphql` property in the `info` block of the OAS spec file and set it to `false`.
    
    The optional `options` structure can use any of the config defined in [oasgraph documentation](https://github.com/graphql/express-graphql#options).


## Example implementation

We use this within an Express-powered API Gateway so that we can provide one unified GraphQL interface to the services we want to expose.

Assuming that we've merged this package into a repo that also contains our specification files and have uploaded them to npmjs.com, we might implement the API gateway something like:

```javascript
const express = require("express");
const graphqlHTTP = require("express-graphql");
const jwt = require("express-jwt");
const cors = require("cors");
const { oas } = require("@elucidat/elucidat-private-npm-package");

module.exports = async function () {
    const app = express();
    let oasOptions = {
        headers: {
            'X-Origin': 'GraphQL'
        },
        /*
         * This will allow oasgraph to send the jwt information along with
         * every resolver request
         */
        tokenJSONpath: '$.jwt'
    };
    const schema = await oas.toGraphQL(oasOptions);

    app.use(cors());
    app.options("*", cors());
    app.use(express.urlencoded({extended: true}));
    app.use(express.json());

    /*
     * Setup for JWT and error/route handling.
     * If we're on the local environment, it's handy to not require the JWT
     * to be present for the graphql playground.
     */
    let unlessPaths = [];
    if (process.env.NODE_ENV === "local") {
        unlessPaths.push("/graphql");
    }
    app.use(
        jwt({
            secret: process.env.JWT_HASH,
            credentialsRequired: true
        }).unless({
            path: unlessPaths
        })
    );

    /*
     * Put the jwt back into the request so oasgraph can use it for
     * the context of each request via the tokenJSONPath option
     */
    app.use(function (req, res, next) {
        if (req.headers && req.headers.authorization) {
            req.jwt = req.headers.authorization.replace(/^Bearer /, '');
        }
        next();
    });

    /*
     * Establish the graphql end-point.
     * For local development only we want to enable the graphql playground.
     */
    app.use(
        "/graphql",
        graphqlHTTP({
            schema,
            graphiql: process.env.NODE_ENV === "local"
        })
    );

    return app;
};

```

We're more than happy if you want to make any comments or pull requests for improvements!