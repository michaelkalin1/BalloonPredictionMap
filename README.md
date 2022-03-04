# BalloonPredictionMap

Show multiple simultaneous CUSF balloon predictions over a map of U.S. restricted airspace. Useful for planning weather balloon launches within the
continental United States.

[![prediction map](https://i.imgur.com/XzTPg4M.png)](http://bpp.umd.edu/predicts)

## Features

- run predictions from multiple sites simultaneously (as defined in `launch_locations.geojson`)
- right-click anywhere on the map to immediately run a prediction from that location

## Installation

This website is entirely client-based, so can either be hosted on a server or viewed locally on a computer.

1. either
    - [download the source code directly](https://github.com/zacharyburnett/BalloonPredictionMap/archive/refs/heads/main.zip) or
    - `git clone` this repository
      ```
      git clone https://github.com/zacharyburnett/BalloonPredictionMap
      ```
3. open `index.html` in a web browser

## Customization

To customize launch locations, edit the file `launch_locations.geojson` with launch sites in the following format:

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

## Examples

1. http://bpp.umd.edu/predicts 
