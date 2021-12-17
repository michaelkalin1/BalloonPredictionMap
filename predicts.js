let GLOBAL_RUN_ID = 0;
let RUN_INTERRUPTED = false;
let ACTIVE_PREDICT_LAYERS;

const UTC_OFFSET_MINUTES = (new Date()).getTimezoneOffset();

let CUSTOM_LAUNCH_LOCATION_LAYER;
const CUSTOM_LAUNCH_LOCATION_NAME = 'custom launch location';

const API_URLS = {
    'CUSF': 'https://predict.cusf.co.uk/api/v1/', 'lukerenegar': 'https://predict.lukerenegar.com/api/v1.1/'
};

const API_SOURCE = 'CUSF';

OVERLAY_LAYERS['reference']['McDonald\'s Locations'] = MCDONALDS_LOCATIONS_LAYER;
OVERLAY_LAYERS['reference']['Launch Locations'] = LAUNCH_LOCATIONS_LAYER;
OVERLAY_LAYERS['predicts'] = {};

let LAYER_CONTROL = L.control.groupedLayers(BASE_LAYERS, OVERLAY_LAYERS);
MAP.addControl(LAYER_CONTROL);

/* retrieve a single predict from the given API and convert to a GeoJSON Feature (LineString) */
function getPredictLineString(api_url, name, address, longitude, latitude, datetime_utc, ascent_rate, burst_altitude, sea_level_descent_rate) {
    return new Promise(function (resolve, reject) {
        AJAX.get(api_url, {
            'launch_longitude': longitude,
            'launch_latitude': latitude,
            'launch_datetime': datetime_utc,
            'ascent_rate': ascent_rate,
            'burst_altitude': burst_altitude,
            'descent_rate': sea_level_descent_rate
        }, function (response) {
            let output_feature = {
                'type': 'Feature', 'geometry': {
                    'type': 'LineString', 'coordinates': []
                }, 'properties': {
                    'name': name,
                    'dataset': response['request']['dataset'] + ' UTC',
                    'address': address,
                    'location': '(' + (longitude - 360).toFixed(5) + ', ' + latitude.toFixed(5) + ')'
                }
            };

            for (let stage of response['prediction']) {
                for (let entry of stage['trajectory']) {
                    output_feature['geometry']['coordinates'].push([entry['longitude'] - 360, entry['latitude'], entry['altitude']]);
                }
            }

            resolve(output_feature);
        });
    });
}

/* retrieve predict for a single launch location as a GeoJSON FeatureCollection */
async function getPredictLayer(api_url, launch_location_name, address, launch_longitude, launch_latitude, launch_datetime = null, ascent_rate = null, burst_altitude = null, sea_level_descent_rate = null) {
    let predict_geojson = {'type': 'FeatureCollection', 'features': []};

    if (launch_datetime == null) {
        let time = document.getElementById('launch_time').value.split(':');

        let hour = (parseInt(time[0]) + (UTC_OFFSET_MINUTES / 60));
        if (hour < 10) {
            hour = '0' + hour;
        }

        let minute = (parseInt(time[1]) + (UTC_OFFSET_MINUTES % 60));
        if (minute < 10) {
            minute = '0' + minute;
        }

        launch_datetime = document.getElementById('launch_date').value + 'T' + hour + ':' + minute + ':00Z';
    }

    if (ascent_rate == null) {
        ascent_rate = document.getElementById('ascent_rate').value;
    }

    if (burst_altitude == null) {
        burst_altitude = document.getElementById('burst_altitude').value;
    }

    if (sea_level_descent_rate == null) {
        sea_level_descent_rate = document.getElementById('sea_level_descent_rate').value;
    }

    /* CUSF API requires longitude in 0-360 format */
    if (launch_longitude < 0) {
        launch_longitude = launch_longitude + 360;
    }

    await getPredictLineString(api_url, launch_location_name, address, launch_longitude, launch_latitude, launch_datetime, ascent_rate, burst_altitude, sea_level_descent_rate).then(function (feature) {
        predict_geojson['features'].push(feature);
    }).catch(function (response) {
        console.log('Prediction error: ' + response.status + ' ' + response.error);
    });

    let predict_layer_style = function (feature) {
        if (feature.feature != null) {
            feature = feature.feature;
        }

        return {
            'weight': 5, 'color': feature.properties['name'] === CUSTOM_LAUNCH_LOCATION_NAME ? '#f00' : '#f0f'
        };
    };

    return L.geoJSON(predict_geojson, {
        'onEachFeature': highlightAndPopupOnClick, 'style': predict_layer_style, 'attribution': 'Prediction - ' + api_url
    });
}


/* remove all predict layers from the map */
function removePredictLayers() {
    for (let layer_group in OVERLAY_LAYERS) {
        if (layer_group === 'predicts') {
            for (let layer_name in OVERLAY_LAYERS[layer_group]) {
                LAYER_CONTROL.removeLayer(OVERLAY_LAYERS[layer_group][layer_name]);
                MAP.removeLayer(OVERLAY_LAYERS[layer_group][layer_name]);
                delete OVERLAY_LAYERS[layer_group][layer_name];
            }
        }
    }
}

/* deselect all predict layers from the map, but keep them in the layer control */
function hidePredictLayers() {
    for (let layer_group in OVERLAY_LAYERS) {
        if (layer_group === 'predicts') {
            for (let layer_name in OVERLAY_LAYERS[layer_group]) {
                MAP.removeLayer(OVERLAY_LAYERS[layer_group][layer_name]);
            }
        }
    }
}

/* refresh map with new predicts using given parameters */
async function updatePredictLayers(resize = false) {
    let run_id = ++GLOBAL_RUN_ID;

    let previous_active_predict_layers = ACTIVE_PREDICT_LAYERS;

    if (!RUN_INTERRUPTED) {
        ACTIVE_PREDICT_LAYERS = LAYER_CONTROL.getActiveOverlayLayers()['predicts'];
    }

    let api_url = API_URLS[API_SOURCE];
    let launch_locations_features = LAUNCH_LOCATIONS_LAYER.getLayers();

    /* add custom launch location if it exists */
    if (CUSTOM_LAUNCH_LOCATION_LAYER != null) {
        launch_locations_features.unshift(...CUSTOM_LAUNCH_LOCATION_LAYER.getLayers());
    }

    let time = document.getElementById('launch_time').value.split(':');

    let hour = (parseInt(time[0]) + (UTC_OFFSET_MINUTES / 60));
    if (hour < 10) {
        hour = '0' + hour;
    }

    let minute = (parseInt(time[1]) + (UTC_OFFSET_MINUTES % 60));
    if (minute < 10) {
        minute = '0' + minute;
    }

    let launch_datetime_utc = document.getElementById('launch_date').value + 'T' + hour + ':' + minute + ':00Z';
    let ascent_rate = document.getElementById('ascent_rate').value;
    let burst_altitude = document.getElementById('burst_altitude').value;
    let sea_level_descent_rate = document.getElementById('sea_level_descent_rate').value;

    removePredictLayers();

    let predict_layers = {};
    let layer_index = 1;

    for (let launch_location_feature of launch_locations_features) {
        let address = launch_location_feature.feature.properties['address'];
        let launch_location_name = launch_location_feature.feature.properties['name'] === CUSTOM_LAUNCH_LOCATION_NAME ? CUSTOM_LAUNCH_LOCATION_NAME : address.match(/(,\s)(.*?)(,\s)/g)[0].replaceAll(', ', '');
        let launch_location = launch_location_feature.getLatLng();

        let predict_layer = await getPredictLayer(api_url, launch_location_name, address, launch_location['lng'], launch_location['lat'], launch_datetime_utc, ascent_rate, burst_altitude, sea_level_descent_rate);
        predict_layers[launch_location_name] = predict_layer;

        /* check if user has changed options in the meantime */
        if (run_id === GLOBAL_RUN_ID) {
            OVERLAY_LAYERS['predicts'][launch_location_name] = predict_layer;
            LAYER_CONTROL.addOverlay(predict_layer, launch_location_name, 'predicts');

            if (ACTIVE_PREDICT_LAYERS != null) {
                /* add predict layers to map if they were already selected previously */
                if (ACTIVE_PREDICT_LAYERS[launch_location_name] != null) {
                    MAP.addLayer(predict_layer);
                }
            } else {
                /* if no layers were selected previously, add the first few layers */
                if (layer_index <= 5) {
                    MAP.addLayer(predict_layer);
                }

                layer_index++;
            }

            if (SELECTED_FEATURE != null && predict_layer._layers != null) {
                for (let feature_index in predict_layer._layers) {
                    let feature = predict_layer._layers[feature_index];

                    if (JSON.stringify(feature.feature.properties) === JSON.stringify(SELECTED_FEATURE.feature.properties)) {
                        SELECTED_FEATURE = feature;
                        SELECTED_FEATURE_ORIGINAL_STYLE = SELECTED_FEATURE.options.style;
                        highlightFeature(SELECTED_FEATURE);
                    }
                }
            }
        } else {
            RUN_INTERRUPTED = true;
            ACTIVE_PREDICT_LAYERS = previous_active_predict_layers;
            return;
        }
    }

    RUN_INTERRUPTED = false;

    if (resize) {
        resizeToOverlayLayers();
    }
}


async function setCustomLaunchLocation(click_event) {
    if (CUSTOM_LAUNCH_LOCATION_LAYER != null) {
        LAYER_CONTROL.removeLayer(CUSTOM_LAUNCH_LOCATION_LAYER);
        MAP.removeLayer(CUSTOM_LAUNCH_LOCATION_LAYER);

        let active_predict_layers = LAYER_CONTROL.getActiveOverlayLayers()['predicts'];

        if (active_predict_layers[CUSTOM_LAUNCH_LOCATION_NAME] != null) {
            LAYER_CONTROL.removeLayer(active_predict_layers[CUSTOM_LAUNCH_LOCATION_NAME]);
            MAP.removeLayer(active_predict_layers[CUSTOM_LAUNCH_LOCATION_NAME]);
        }
    }

    let click_longitude = click_event.latlng.lng;
    let click_latitude = click_event.latlng.lat;

    let coordinates_string = '(' + click_longitude.toFixed(5) + ', ' + click_latitude.toFixed(5) + ')';

    let custom_launch_location_geojson = {
        'type': 'FeatureCollection', 'name': 'custom_launch_location', 'crs': {
            'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}
        }, 'features': [{
            'type': 'Feature', 'properties': {
                'name': CUSTOM_LAUNCH_LOCATION_NAME, 'address': coordinates_string
            }, 'geometry': {'type': 'Point', 'coordinates': [click_longitude, click_latitude]}
        }]
    };

    let api_url = API_URLS[API_SOURCE];

    let custom_launch_location_predict_layer = await getPredictLayer(api_url, CUSTOM_LAUNCH_LOCATION_NAME, null, click_longitude, click_latitude);
    MAP.addLayer(custom_launch_location_predict_layer);
    LAYER_CONTROL.addOverlay(custom_launch_location_predict_layer, CUSTOM_LAUNCH_LOCATION_NAME, 'predicts');
    OVERLAY_LAYERS['predicts'][CUSTOM_LAUNCH_LOCATION_NAME] = custom_launch_location_predict_layer;

    CUSTOM_LAUNCH_LOCATION_LAYER = L.geoJson(custom_launch_location_geojson, {'onEachFeature': popupFeaturePropertiesOnClick});
    LAYER_CONTROL.addOverlay(CUSTOM_LAUNCH_LOCATION_LAYER, CUSTOM_LAUNCH_LOCATION_NAME, 'reference');
}

function downloadPredictsKML() {
    let active_predict_layers = LAYER_CONTROL.getActiveOverlayLayers()['predicts'];

    if (Object.keys(active_predict_layers).length > 0) {
        for (let launch_location_name in active_predict_layers) {
            let predict_geojson = active_predict_layers[launch_location_name].toGeoJSON();

            if (predict_geojson['features'].length > 0) {
                let output_kml = tokml(predict_geojson);

                output_kml = output_kml.replace(/<LineString>/g, '<LineString><extrude>1</extrude><tesselate>1</tesselate><altitudeMode>absolute</altitudeMode>');

                let download_filename = 'predicts_' + launch_location_name.replace(/[-_:ZT ]/g, '') + '.kml';
                let download_link = document.createElement('a');
                let xml_blob = new Blob([output_kml], {'type': 'text/xml'});

                download_link.setAttribute('href', window.URL.createObjectURL(xml_blob));
                download_link.setAttribute('download', download_filename);

                download_link.click();
            } else {
                alert('Predicts have not loaded yet.');
            }
        }
    } else {
        alert('No predicts.');
    }
}

function downloadURI(uri, name) {
    let download_link = document.createElement('a');
    download_link.download = name;
    download_link.href = uri;
    download_link.click();
}
