//require('streamline').register({});
import { _ } from 'streamline-runtime';
import { Server } from '../../lib/application';
import { MockConnector } from './mockConnector';
import { ConnectorHelper } from '../../lib/core';
import { devices } from 'ez-streams'
const path = require('path');

const port = 3001;
const baseUrl = 'http://localhost:' + port;

const config = {
    // defaultDatasource: 'mock',
    modelsLocation: path.resolve(path.join(__dirname, '../models')),
    connectors: {
        mock: {
            datasources: {
                "mock": {}
            }
        }
    }
};


function request(_: _, method: string, url: string, data?: any, headers?: any) {
    headers = headers || {
        'content-type': 'application/json'
    };
    let resp = devices.http.client({
        url: baseUrl + url,
        method: method,
        headers: headers
    }).end(JSON.stringify(data)).response(_);
    return {
        status: resp.statusCode,
        headers: resp.headers,
        body: resp.readAll(_)
    };
}

export class Fixtures {

    static setup = (_, done) => {
        if (!_.context.__server) {
            let server: Server = _.context.__server = require('../..')(config);
            server.on('initialized', function () {
                console.log("Server initialized");
                done();
            });
            server.addConnector(new MockConnector());
            server.init(_);
            server.start(_, 3001);
        }
        console.log("Connectors registered on setup:", _.context['connectors']);
        let connector = <MockConnector>ConnectorHelper.getConnector('mock');
        connector.resetStorage();
        //console.log("CONTEXT:", _.context);
        return _.context.__server
    }

    static dumpStorage = () => {
        (<MockConnector>ConnectorHelper.getConnector('mock')).dumpStorage();
    }

    static get = (_: _, url: string, headers?: any) => {
        return request(_, 'GET', url, null, headers);
    }

    static post = (_: _, url: string, data: any, headers?: any) => {
        return request(_, 'POST', url, data, headers);
    }

    static put = (_: _, url: string, data: any, headers?: any) => {
        return request(_, 'PUT', url, data, headers);
    }

    static delete = (_: _, url: string, headers?: any) => {
        return request(_, 'DELETE', url, null, headers);
    }

    static patch = (_: _, url: string, headers?: any) => {
        return request(_, 'PATCH', url, headers);
    }

    static execAsync = (done, fn): void => {
        fn(function (err, res) {
            if (err) done(err);
            else done();
        });
    }
}




