/**
 * RoutEasy Example Project v.1.0
 * Last updated: 09/29/2016
 */

var req = require('request');
var async = require('async');
var config = require('./config');

var request = req.defaults(
    {
        json: true,
        jar: true
    });

async.waterfall(
    [
        /**
         * 1. LOGIN
         *
         * Routeasy currently supports plain-text credentials over HTTP.
         *
         */
        function(callback)
        {
            request(
                {
                    json: true,
                    url: config.host + '/auth/signin',
                    method: 'POST',
                    body: config.credentials
                }, function(err, response)
                {
                    console.log('1. user display name: ' + response.body.displayName);
                    callback();
                });
        },

        /**
         * 2. VEHICLE LISTING
         *
         */
        function(callback)
        {
            request(
                {
                    url: config.host + '/vehicles',
                    method: 'GET'
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    console.log('2. first vehicle name: ' + response.body[0].name);
                    callback();
                });
        },

        /**
         * 3. DEPOTS LISTING
         *
         */
        function(callback)
        {
            request(
                {
                    url: config.host + '/depots',
                    method: 'GET'
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    console.log('3. first depot name: ' + response.body[0].name);
                    callback();
                });
        },

        /**
         * 4. GEOCODING
         *
         * Routeasy offers a handy endpoint for geocoding batch deliveries
         *
         */
        function(callback)
        {
            request(
                {
                    url: config.host + '/geoinfo/geocode',
                    method: 'POST',
                    body: require('./samples/deliveries_geocoding')
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    console.log('4. first delivery latitude: ' + response.body[0].address.geocode.lat);
                    callback(null, response.body);
                });
        },
        
        // ---------------------- ORDER CREATION IS NOW DEPRECATED ----------------------
        /**
         * 5. ORDER CREATION
         *
         * Before creating a routing project, one must create an order (delivery set) 
         
        function(callback)
        {
            request(
                {
                    url: config.host + '/orders',
                    method: 'POST',
                    body: require('./samples/new_order')
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    console.log('5. order name: ' + response.body.name);
                    callback();
                });
        },
        */
        // ---------------------- ORDER CREATION IS NOW DEPRECATED ----------------------


        /**
         * 6. ROUTING CREATION AND EXECUTION
         *
         * Currently the API client must send raw data into the 'data' member of the new routing
         *
         */
        function(deliveries, callback)
        {
            var vehicle, depot;
            var createEntity = function(url, src, handle) { return function(callback) { request({url: config.host + url, method: 'POST', body: require(src)}, function(err, response) { handle(response.body); callback() }); }; };
            async.series(
                [
                    createEntity('/vehicles', './samples/new_routing_vehicle', function(v) { vehicle = v; }),
                    createEntity('/depots', './samples/new_routing_depot', function(d) 
                        {
                            /* RoutEasy Core Update: Depots must have window daily restriction defined */
                            d.constraints = { window_daily: { start_time: new Date(1970,1,1,8,0,0), end_time: new Date(1970,1,1,20,0,0) } } ;
                            depot = d; 
                        }),
                ], function(err)
                {
                    var routing = require('./samples/new_routing');
                    routing.data.order = {};
                    routing.data.order.deliveries = deliveries;
                    routing.data.vehicles = [vehicle];
                    routing.data.depots = [depot];
                    routing.vehicles = [vehicle._id];
                    routing.depots = [depot._id];

                    request(
                        {
                            url: config.host + '/routings',
                            method: 'POST',
                            body: routing
                        }, function(err, response)
                        {
                            if(err) { console.error(err); }
                            var r = response.body;
                            console.log('6a. routing name: ' + r.name);
                            console.log('6b. routing vehicle name: ' + r.data.vehicles[0].name);
                            console.log('6c. routing depot name: ' + r.data.depots[0].name);
                            request(
                                {
                                    url: config.host + '/routings/' + r._id + '/versions/starred',
                                    method: 'GET',
                                    body: routing
                                }, function(err, response)
                                {
                                    if(err) { console.error(err); }
                                    var v = response.body;
                                    console.log('6e. routing starred version: ' + v._id);
                                    request(
                                        {
                                            url: config.host + '/versions/' + v._id + '/go',
                                            method: 'POST',
                                        }, function(err, response)
                                        {
                                            if(err) { console.error(err); }
                                            var v = response.body;
                                            var update = function()
                                            {
                                                request(config.host + '/versions/' + v._id, function(err, res)
                                                    {
                                                        if(err) { console.log(err); }
                                                        v = res.body;
                                                        if(['terminated', 'completed'].indexOf(v.state.status) >= 0)
                                                        {
                                                            if(v.state.status === 'terminated')
                                                                console.log('\tfinished with ERROR! check: ' + v._id + ' | ' + JSON.stringify(v.state));
                                                            else
                                                                console.log('\tfinished with SUCCESS!');
                                                            callback();
                                                            return;
                                                        }
                                                        console.log('\t' + v.state.completion.toFixed(0) + '% completed');
                                                        setTimeout(update, 500);
                                                    });
                                            };
                                            update();
                                        });
                                });
                            
                        });
                });
        },

        /**
         * 7. ROUTINGS LISTING
         *
         */
        function(callback)
        {
            request(
                {
                    url: config.host + '/routings',
                    method: 'GET'
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    console.log('7. first routing name: ' + response.body[0].name);
                    callback();
                });
        },


        /**
         * 8. ROUTING VERSIONS LISTING
         *
         */
        function(callback)
        {
            request(
                {
                    url: config.host + '/routings',
                    method: 'GET'
                }, function(err, response)
                {
                    if(err) { console.error(err); }
                    response.body.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
                    var lastRoutingId = response.body[0]._id;
                    console.log('8a. last routing id: ' + response.body[0]._id);
                    console.log('8a. last routing name: ' + response.body[0].name);
                    request(
                        {
                            url: config.host + '/routings/' + lastRoutingId + '/versions',
                            method: 'GET'
                        }, function(err, response)
                        {
                            if(err) { console.error(err); }
                            response.body.sort(function(a, b) { return a.date < b.date ? 1 : -1; });
                            console.log('8c. last version of ' + lastRoutingId + ' id: ' + response.body[0]._id);
                            console.log('8d. last version of ' + lastRoutingId + ' distance: ' + response.body[0].summary.results_total_distance);
                            callback();
                        });
                });
        },

    ]);
