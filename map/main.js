"use strict";

const DISTANCE_CATEGORIES = {
    0: {
        "description": "&nbsp;&nbsp;&nbsp;No data",
        "color": "#d2d2d2"
    },
    10: {
        "description": "<= 10 min",
        "color": "#2ecc71"
    },
    15: {
        "description": "<= 15 min",
        "color": "#16a085"
    },
    20: {
        "description": "<= 20 min",
        "color": "#ffcc00"
    },
    30: {
        "description": "<= 30 min",
        "color": "#f39c12"
    },
    40: {
        "description": "<= 40 min",
        "color": "#e74c3c"
    },
    99: {
        "description": "<= 99 min",
        "color": "#2c3e50"
    }
};

/* ************************************
 * Map set-up
 *************************************/
const mymap = L.map("stationMap", { center: [48.7758, 9.1829], zoom: 13});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    "useCache": true
}).addTo(mymap);
createLegend().addTo(mymap);

let layersControl = L.control.layers(null, null, {"collapsed": false}).addTo(mymap);
let destinationMarker;

for (const itemgroup of itemgroups) {
    const a = document.createElement("a");
    a.appendChild(document.createTextNode(itemgroup.destination.name));
    a.setAttribute("data-station", itemgroup.destination.id);
    document.querySelector("#navigation").appendChild(a);
    a.addEventListener("click", (event) => {
        // Remove existing markers and controls
        clearMap(mymap);
        // Add data to map
        addDataToMap(mymap, itemgroup);
        // Change active link in navigation bar
        const otherNavLinks = document.querySelectorAll(".active")
        for (const link of otherNavLinks) {
            link.classList.toggle("active");
        }
        a.classList.toggle("active");
    });
}

/* ************************************
 * Functions
 *************************************/
function clearMap(map) {
    // Remove the current destination
    if(destinationMarker)
        map.removeLayer(destinationMarker);
    // Remove all layers associated with the control layer
    if(layersControl) {
        for (const [i, layerGroup] of Object.entries(layersControl._layers)) {
            layerGroup.layer.clearLayers();
            layersControl.removeLayer(layerGroup.layer);
        }
    }
}

function addDataToMap(map, itemgroup) {
    // Add the destination marker and all origin markers (layers) to the map
    destinationMarker = createDestinationMarker(itemgroup.destination).addTo(map);
    let layerGroups = createLayerGroupsForStations(itemgroup.stations, itemgroup.destination.id);
    for (const [numberOfChanges, layerGroup] of Object.entries(layerGroups)) {
        map.addLayer(layerGroup);
        layersControl.addOverlay(layerGroup, numberOfChanges + " changes");
    }
    const layersControlTitle = L.DomUtil.create("strong", "");
    layersControlTitle.innerHTML = "# Changes";
    document.querySelector(".leaflet-control-layers-overlays").prepend(layersControlTitle)
}

function createLayerGroupsForStations(stations, destination_id) {
    // Add markers to layers, grouped by number of changes
    const layers_changes = {};
    for (const station of stations) {
        if(!station) {
            continue;
        }
        if(station.station["Globale ID"] === destination_id) {
            continue;
        }
        station.color = getColorForDistance(station.duration);
        station.coordinates = [station.station["Y-Koordinate"].replace(",", "."), station.station["X-Koordinate"].replace(",", ".")];
        station.tooltiptext = `
            <strong> ${station.station["Name mit Ort"]}</strong><br>
            Duration: ${station.duration} min<br>
            Changes: ${station.changes}<br>
            Transportation: ${station.transportation}<br>
        `;
        if(station.duration < 0) {
            station.tooltiptext += "<em>No data found for this station.</em>";
        }
        const marker = createStationMarker(station);

        if(!(station.changes in layers_changes)) {
            layers_changes[station.changes] = L.layerGroup();
        }
        layers_changes[station.changes].addLayer(marker)
    }
    return layers_changes;
}

function createLegend() {
    const legend = L.control({position: "bottomleft"});
    legend.onAdd = function (map) {
        let labels = ["<strong>Distance</strong>"];
        for (const [key, value] of Object.entries(DISTANCE_CATEGORIES)) {
            labels.push('<i class="legend-item" style="background:' + value.color + '"></i> ' + value.description);
        }
        const div = L.DomUtil.create("div", "info legend");
        div.innerHTML = labels.join("<br>");
        return div;
    };
    return legend;
}

function createMarkerIcon(color, className) {
    return L.divIcon({
      className: "chr-marker " + className,
      iconAnchor: [0, 0],
      labelAnchor: [-6, 0],
      popupAnchor: [-10, -24],
      html: `<span style="background-color: ${color};"></span>`
    });
}

function createStationMarker(station) {
    const marker = L.marker(station.coordinates, {icon: createMarkerIcon(station.color, "")});
    marker.bindPopup(station.tooltiptext);
    return marker;
}

function createDestinationMarker(destination) {
    const marker = L.marker(destination.coordinates, {icon: createMarkerIcon("#ffffff", "destination-marker")});
    marker.bindPopup("<strong>" + destination.name + "</strong>" );
    return marker;
}

function getColorForDistance(duration) {
    // Find the color that matches the distance
    for (const [distance, value] of Object.entries(DISTANCE_CATEGORIES)) {
        if(duration <= distance) {
            return value.color;
        }
    }
    // default color is black
    return "#000000";
}
