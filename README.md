# BalloonPredictionMap
HTML for a client-side Leaflet web map showing CUSF balloon prediction over U.S. restricted airspace.

[![prediction map](https://i.imgur.com/0ORhXjd.png)](http://nearspace.umd.edu/predicts)

To customize launch locations, either directly edit `launch_locations.geojson` 
or set the variable `LAUNCH_LOCATIONS_FILENAME` to a GeoJSON file, where individual launch sites have the following format:
```json
{
  "type": "Feature",
  "properties": {
    "name": "Valley Elementary School",
    "phone": 2402363000,
    "address": "3519 Jefferson Pike, Jefferson, MD 21755",
    "url": "<a href='https:\/\/education.fcps.org\/ves\/home'>link<\/a>",
    "x": -77.547824,
    "y": 39.359031
  },
  "geometry": {
    "type": "Point",
    "coordinates": [
      -77.547824,
      39.359031
    ]
  }
}
```

### Examples:
1. http://nearspace.umd.edu/predicts 
