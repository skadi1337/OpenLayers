import BingMaps from 'ol/source/BingMaps.js';
import Map from 'ol/Map.js';
import TileLayer from 'ol/layer/Tile.js';
import View from 'ol/View.js';
import OSM from 'ol/source/OSM';
import { Vector as VectorLayer } from 'ol/layer'
import { Vector } from 'ol/source'
import * as olSphere from 'ol/sphere';
import { Draw, DragBox } from 'ol/interaction'
import { altKeyOnly } from 'ol/events/condition'
import { Polygon } from 'ol/geom'
import Feature from 'ol/Feature';
import { Style, Stroke, Fill, Circle } from 'ol/style'
import { boundingExtent, getTopLeft, getTopRight, getBottomRight, getBottomLeft } from 'ol/extent'
import { fromLonLat, transform, useGeographic, toLonLat, disableCoordinateWarning } from 'ol/proj.js';
import XYZ from 'ol/source/XYZ';

const TARGET_ZOOM = 18              // Значения zoom для разбиения на тайлы
const LAT_DELTA_400 = 0.00214576721 // для zoom = 18, и 400х400
const LON_DELTA_400 = 0.00173286842 // если изменить параметры, то измениться и дельта

const LAT_DELTA = 0.00343322753     //18 zoom, 640x640
const LON_DELTA = 0.00277269925

const LAT_DELTA_METERS = 308.298566865291   // Линейный размеры кадра в метрах, при зуме 18
const LON_DELTA_METERS = 308.3040143497024;

const MAX_TILES = 100           // макс кол-во тайлов в разбиении

const base_extent = [-180, -85, 180, 85] // Базовые границы области выдимости (весь земной шар)

var current_zoom;
var current_center;

var is_debug = false;
var selected_extent = null;
var isDrawingPoints = false;

var curr_tile = -1;
var poinstArray = [];
var pointSelectHint = document.getElementById('pointSelectHint');
var pointSelectHint2 = document.getElementById('pointSelectHint2');

var showConturs = false;

var curr_x, curr_y = null, curr_final_x, curr_final_y, curr_top_left, curr_bot_right;

// Необходимо для перехода OpenLayers на географические координаты
useGeographic();

// Включение/Выключение режима выделения точек
document.addEventListener('keydown', function (evt) {
    if (evt.keyCode === 13) {
        isDrawingPoints = !isDrawingPoints;
    }
    if (isDrawingPoints) {
        pointSelectHint.innerHTML = 'Чтобы включить/выключить режим выделения точек нажмите enter 🟢'
        pointSelectHint2.innerHTML = 'Чтобы включить/выключить режим выделения точек нажмите enter 🟢'
        map1.addInteraction(drawPoint1);
        map2.addInteraction(drawPoint2);
    }
    else {
        pointSelectHint.innerHTML = 'Чтобы включить/выключить режим выделения точек нажмите enter 🔴'
        pointSelectHint2.innerHTML = 'Чтобы включить/выключить режим выделения точек нажмите enter 🔴'
        map1.removeInteraction(drawPoint1);
        map2.removeInteraction(drawPoint2);
    }
});


// Источник спутниковой карты, взят из google maps
const googleSatelliteSource = new XYZ({
    url: 'http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', // http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga
    attributions: [
        '© Google'
    ],
    crossOrigin: 'Anonymous'
});

// Слой со спутниковой картой
const googleSatelliteLayer = new TileLayer({
    source: googleSatelliteSource
});

// Слой с картой дорог, источник взят из сервисв OpenStreetMaps (OSM)
const roadLayer = new TileLayer({
    source: new OSM(),
});


// слой с областью выделения
var highlightLayer = new VectorLayer({
    source: new Vector(),
    style: new Style({
        stroke: new Stroke({
            color: 'red',
            width: 2
        }),
        fill: new Fill({
            color: 'rgba(255, 0, 0, 0)'
        })
    })
});

// слой с контурами
var highlightLayer2 = new VectorLayer({
    source: new Vector(),
    style: new Style({
        stroke: new Stroke({
            color: 'blue',
            width: 2
        }),
        fill: new Fill({
            color: 'rgba(0, 255, 0, 0)'
        })
    })
});

// слой с точками
var pointsLayer = new VectorLayer(
    {
        source: new Vector(),
        style: new Style({
            image: new Circle({
                radius: 5,
                fill: new Fill({
                    color: 'black'
                }),
                stroke: new Stroke({
                    color: 'black',
                    width: 1
                })
            })
        })
    }
)

// Это view, он же видимы кадр. Для обеих карт используется один view.
const view = new View({
    center: [33.13329651842474, 36.137167149366945],
    zoom: 10,
    extent: base_extent
});


view.on('change:center', showCoordinates);

// Карта дорог
const map1 = new Map({
    target: 'roadMap',
    layers: [roadLayer],
    view: view,
});

// Карта спутника
const map2 = new Map({
    target: 'aerialMap',
    layers: [googleSatelliteLayer],
    view: view,
});

// Области выделения
var selection1 = new DragBox({
    condition: altKeyOnly,
});

var selection2 = new DragBox({
    condition: altKeyOnly,
});

// Выделение точки
var drawPoint1 = new Draw({
    source: pointsLayer.getSource(),
    type: 'Point',
    style: new Style({
        image: new Circle({
            radius: 0,
            fill: null,
            stroke: null
        })
    })
});

// Добавление точки в массив при ее установке на карте
drawPoint1.on('drawend', function (event) {
    var feature = event.feature;
    var coords = feature.getGeometry().getCoordinates();
    poinstArray.push(curr_tile);
    poinstArray.push(coords[0]);
    poinstArray.push(coords[1]);
});

var drawPoint2 = new Draw({
    source: pointsLayer.getSource(),
    type: 'Point',
    style: new Style({
        image: new Circle({
            radius: 0,
            fill: null,
            stroke: null
        })
    })
});

drawPoint2.on('drawend', function (event) {
    var feature = event.feature;
    var coords = feature.getGeometry().getCoordinates();
    poinstArray.push(curr_tile);
    poinstArray.push(coords[0]);
    poinstArray.push(coords[1]);
});

map1.addInteraction(selection1);
map1.addLayer(highlightLayer);

map2.addInteraction(selection2);
map2.addLayer(highlightLayer);

map1.addLayer(highlightLayer2);
map2.addLayer(highlightLayer2);

map1.addLayer(pointsLayer);
map2.addLayer(pointsLayer);

// Обработка события выделения области на карте
selection1.on('boxend', function (event) {
    var geometry = selection1.getGeometry();
    var extent = geometry.getExtent();

    var bottomLeft = toLonLat(getBottomLeft(extent));
    var topRight = toLonLat(getTopRight(extent));


    selected_extent = []
    selected_extent.push(bottomLeft[0]);
    selected_extent.push(bottomLeft[1]);
    selected_extent.push(topRight[0]);
    selected_extent.push(topRight[1]);

    var feature = new Feature({
        geometry: new Polygon([
            [
                [bottomLeft[0], bottomLeft[1]],
                [bottomLeft[0], topRight[1]],
                [topRight[0], topRight[1]],
                [topRight[0], bottomLeft[1]],
                [bottomLeft[0], bottomLeft[1]]
            ]
        ])
    });

    highlightLayer.getSource().clear();
    highlightLayer.getSource().addFeature(feature);

});

selection2.on('boxend', function (event) {
    var geometry = selection2.getGeometry();
    var extent = geometry.getExtent();

    var bottomLeft = toLonLat(getBottomLeft(extent));
    var topRight = toLonLat(getTopRight(extent));

    selected_extent = []
    selected_extent.push(bottomLeft[0]);
    selected_extent.push(bottomLeft[1]);
    selected_extent.push(topRight[0]);
    selected_extent.push(topRight[1]);

    var feature = new Feature({
        geometry: new Polygon([
            [
                [bottomLeft[0], bottomLeft[1]],
                [bottomLeft[0], topRight[1]],
                [topRight[0], topRight[1]],
                [topRight[0], bottomLeft[1]],
                [bottomLeft[0], bottomLeft[1]]
            ]
        ])
    });

    highlightLayer.getSource().clear();
    highlightLayer.getSource().addFeature(feature);

});

showCoordinates()

// Отрисовка информации о карте (широта, долгота + debug info)
function showCoordinates() {
    var center = view.getCenter();
    var zoom = view.getZoom();

    var extent = view.calculateExtent()
    var res = view.getResolution()

    // bot left
    var p1 = []
    p1.push(extent[0])
    p1.push(extent[1])

    //top left
    var p2 = []
    p2.push(extent[0])
    p2.push(extent[3])

    //bot right
    var p3 = []
    p3.push(extent[2])
    p3.push(extent[1])

    var xd = olSphere.getDistance(p1, p2);
    var yd = olSphere.getDistance(p1, p3);

    var coordinates = document.getElementById('coordinates');
    coordinates.innerHTML = 'Долгота: ' + center[1] + '<br>Широта: ' + center[0];
    if (is_debug) {
        coordinates.innerHTML = coordinates.innerHTML + '<br>\nZoom: ' + zoom + '<br>Границы: ' + extent + '<br>Разрешение: ' + res
            + '<br>Длина и ширина (м): ' + String(xd) + ' ' + String(yd);
    }
}

// Функция сохранения тайла при разбиении учатска на тайлы
function take_screen(x, y, i) {
    const mapCanvas = document.createElement('canvas');
    const size = map2.getSize();
    mapCanvas.width = size[0];
    mapCanvas.height = size[1];
    const mapContext = mapCanvas.getContext('2d');
    Array.prototype.forEach.call(
        map2.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'),
        function (canvas) {
            if (canvas.width > 0) {
                const opacity =
                    canvas.parentNode.style.opacity || canvas.style.opacity;
                mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                let matrix;
                const transform = canvas.style.transform;
                if (transform) {
                    matrix = transform
                        .match(/^matrix\(([^\(]*)\)$/)[1]
                        .split(',')
                        .map(Number);
                } else {
                    matrix = [
                        parseFloat(canvas.style.width) / canvas.width,
                        0,
                        0,
                        parseFloat(canvas.style.height) / canvas.height,
                        0,
                        0,
                    ];
                }
                CanvasRenderingContext2D.prototype.setTransform.apply(
                    mapContext,
                    matrix
                );
                const backgroundColor = canvas.parentNode.style.backgroundColor;
                if (backgroundColor) {
                    mapContext.fillStyle = backgroundColor;
                    mapContext.fillRect(0, 0, canvas.width, canvas.height);
                }
                mapContext.drawImage(canvas, 0, 0);
            }
        }
    );
    mapContext.globalAlpha = 1;
    mapContext.setTransform(1, 0, 0, 1, 0, 0);

    const link = document.createElement('a');
    link.href = mapCanvas.toDataURL();
    link.download = String(i) + '-map.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    map2.renderSync();
}

function test_params() {
    view.setZoom(TARGET_ZOOM)
}

test_params()

// Функция разбиения области выделения на тайлы
async function tileUp() {
    if (selected_extent === null) {
        alert("Область не выбрана");
        return;
    }

    var extent = selected_extent;

    highlightLayer.setVisible(false);
    pointsLayer.setVisible(false);

    var top_left = [extent[0], extent[1]];
    var bot_right = [extent[2], extent[3]];


    var base_center = view.getCenter();
    var base_zoom = view.getZoom();

    var xdelta = LAT_DELTA / 2;
    var ydelta = LON_DELTA / 2;

    var x = top_left[0] + xdelta;
    var y = top_left[1] + ydelta;

    var final_x = bot_right[0];
    var final_y = bot_right[1];

    var xcnt = (final_x - x) / LAT_DELTA;
    var ycnt = (final_y - y) / LON_DELTA;

    if (xcnt + ycnt > MAX_TILES) {
        alert("Слишком маленький масштаб");
        return;
    }

    var i = 0;

    var text = String(LAT_DELTA) + ' ' + String(LON_DELTA)

    view.setZoom(TARGET_ZOOM)


    while (y <= final_y) {
        while (x <= final_x) {
            view.setCenter([x, y]);

            await new Promise((resolve) => {
                map2.once('rendercomplete', resolve);
            });

            text = text + '\n' + String(i) + ' ' + String(x) + ' ' + String(y)
            take_screen(x, y, i)
            x = x + LAT_DELTA;
            i = i + 1;

        }

        y = y + LON_DELTA;
        x = top_left[0] + xdelta;
    }

    var filename = "tile-coordinates.txt";
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, filename);

    view.setCenter(base_center);
    view.setZoom(base_zoom);

    highlightLayer.setVisible(true);
    pointsLayer.setVisible(true);
}

const toolsDiv = document.getElementById("toolsDiv");
const handSelectDiv = document.getElementById("handSelectDiv");

// Функция "ручного режима"
function handSelect() {

    if (selected_extent === null) {
        alert("Область не выбрана");
        return;
    }

    current_center = view.getCenter();
    current_zoom = view.getZoom();

    toolsDiv.style.display = "none";
    handSelectDiv.style.display = "flex";

    var extent = selected_extent;
    highlightLayer.setVisible(false);

    var top_left = [extent[0], extent[1]];
    var bot_right = [extent[2], extent[3]];

    curr_top_left = top_left;
    curr_bot_right = bot_right;


    var xdelta = LAT_DELTA / 2;
    var ydelta = LON_DELTA / 2;

    var x = top_left[0] + xdelta;
    var y = top_left[1] + ydelta;

    curr_x = x;
    curr_y = y;

    var final_x = bot_right[0];
    var final_y = bot_right[1];

    curr_final_x = final_x;
    curr_final_y = final_y;

    var xcnt = (final_x - x) / LAT_DELTA;
    var ycnt = (final_y - y) / LON_DELTA;

    if (xcnt + ycnt > MAX_TILES) {
        alert("Слишком маленький масштаб");
        return;
    }

    var i = 0;
    curr_tile = 0;

    view.setZoom(TARGET_ZOOM)
    view.setCenter([x, y]);

}

function updateMap() {
    var latitude = parseFloat(document.getElementById('latitude').value);
    var longitude = parseFloat(document.getElementById('longitude').value);

    view.setCenter([longitude, latitude]);
}

function clearSelectes() {
    highlightLayer.getSource().clear();
    selected_extent = null;
}

// Функция загрузки файла с координатами контуров
function parseFile() 
{

    var fileInput = document.getElementById('file-input');
    var file = fileInput.files[0];

    if (!file) {
        alert('Пожалуйста, выберете файл с контурами.');
        return;
    }

    showConturs = true;
    var fileReader = new FileReader();

    fileReader.onload = function (event) {
        var fileContent = event.target.result;
        var lines = fileContent.trim().split('\n');


        lines.forEach(function (line) {
            var numbers = [];

            var lineNumbers = line.trim().split(/\s+/);
            lineNumbers.forEach(function (number) {
                numbers.push(parseFloat(number));
            });

            numbers.push(numbers[0]);
            numbers.push(numbers[1]);

            var pairs = [];
            for (var i = 0; i < numbers.length; i += 2) {
                var pair = [numbers[i], numbers[i + 1]];
                pairs.push(pair);
            }

            var coordinates = [pairs];

            var feature = new Feature({
                geometry: new Polygon(coordinates)
            });

            highlightLayer2.getSource().addFeature(feature)
        });
    };

    fileReader.readAsText(file);
}

// Очищает контуры
function clearConturs() {
    highlightLayer2.getSource().clear();
}

// Очищает точки
function clearPoints() {
    pointsLayer.getSource().clear();
    poinstArray = [];
    curr_tile = -1;
}

// Функция для скачивания файла с координатами точек
function downloadPointsFile() {
    var len = poinstArray.length;

    if (len == 0) {
        alert('Не выбрано ни одной точки.');
        return;
    }

    var text = String(poinstArray);

    var filename = "point-coordinates.txt";
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    saveAs(blob, filename);

}


// Функция перехода на следующий тайл в ручном режиме
function nextTile() {
    if (curr_y == null) {
        return;
    }

    if (curr_x > curr_final_x) {
        
        curr_y = curr_y + LON_DELTA;
        curr_x = curr_top_left[0] + (LAT_DELTA / 2);

        if (curr_y > curr_final_y) {
            alert('Изображения закончились');
            endHandSelect();
            return;
        }

        nextTile();
    }
    else {
        curr_tile = curr_tile + 1;
        curr_x = curr_x + LAT_DELTA;

        view.setCenter([curr_x, curr_y]);
    }
}

// Функция заверщения ручного режима
function endHandSelect() {
    toolsDiv.style.display = "block";
    handSelectDiv.style.display = "none";

    view.setCenter(current_center);
    view.setZoom(current_zoom);

    curr_tile = -1;
    curr_y = null;

    highlightLayer2.setVisible(true);
    highlightLayer.setVisible(true);
}

function showContursInHandSelect()
{
    if (showConturs == false)
    {
        highlightLayer2.setVisible(true);
    }
    else
    {
        highlightLayer2.setVisible(false);
    }

    showConturs = !showConturs;
}

const checkbox1 = document.getElementById('checkbox1');
const checkbox2 = document.getElementById('checkbox2');


// Далее идет привязка кнопок из index.html к функциям выше
var button = document.getElementById('showOnMapButton');
button.addEventListener('click', updateMap);

var buttonTiles = document.getElementById('makeTilesButton');
buttonTiles.addEventListener('click', tileUp)

var buttonHandSelect = document.getElementById('makeHandSelection');
buttonHandSelect.addEventListener('click', handSelect)

var clearConturButton = document.getElementById('clearConturButton');
clearConturButton.addEventListener('click', clearConturs)

var clearPointsButton = document.getElementById('clearPoints');
clearPointsButton.addEventListener('click', clearPoints);

var clearSelection = document.getElementById('clearSelectionButton');
clearSelection.addEventListener('click', clearSelectes)

var drawConturs = document.getElementById('drawContursButton');
drawConturs.addEventListener('click', parseFile)

var switchDebug = document.getElementById('switchDebug');
switchDebug.addEventListener('click', function () { is_debug = !is_debug; showCoordinates() })

var getPointsButton = document.getElementById('getPoints');
getPointsButton.addEventListener('click', downloadPointsFile)

var nextTileButton = document.getElementById('nextTile');
nextTileButton.addEventListener('click', nextTile);

var endHandSelectButton = document.getElementById('endHandSelect');
endHandSelectButton.addEventListener('click', endHandSelect)

var showContursInHandSelectButton = document.getElementById('showContursInHandSelect');
showContursInHandSelectButton.addEventListener('click', showContursInHandSelect)

// Сохранение спутниковой и дорожной карты в зависимости от установленных галочек
var saveButton = document.getElementById('saveMapButton');
saveButton.addEventListener('click', function () {

    if (checkbox1.checked) {
        map1.once('rendercomplete', function () {
            const mapCanvas = document.createElement('canvas');
            const size = map1.getSize();
            mapCanvas.width = size[0];
            mapCanvas.height = size[1];
            const mapContext = mapCanvas.getContext('2d');
            Array.prototype.forEach.call(
                map1.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'),
                function (canvas) {
                    if (canvas.width > 0) {
                        const opacity =
                            canvas.parentNode.style.opacity || canvas.style.opacity;
                        mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                        let matrix;
                        const transform = canvas.style.transform;
                        if (transform) {
                            // Get the transform parameters from the style's transform matrix
                            matrix = transform
                                .match(/^matrix\(([^\(]*)\)$/)[1]
                                .split(',')
                                .map(Number);
                        } else {
                            matrix = [
                                parseFloat(canvas.style.width) / canvas.width,
                                0,
                                0,
                                parseFloat(canvas.style.height) / canvas.height,
                                0,
                                0,
                            ];
                        }
                        // Apply the transform to the export map context
                        CanvasRenderingContext2D.prototype.setTransform.apply(
                            mapContext,
                            matrix
                        );
                        const backgroundColor = canvas.parentNode.style.backgroundColor;
                        if (backgroundColor) {
                            mapContext.fillStyle = backgroundColor;
                            mapContext.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        mapContext.drawImage(canvas, 0, 0);
                    }
                }
            );
            mapContext.globalAlpha = 1;
            mapContext.setTransform(1, 0, 0, 1, 0, 0);

            const link = document.getElementById('RmapDownload');
            link.href = mapCanvas.toDataURL();
            link.click();

        });
        map1.renderSync();
    }

    if (checkbox2.checked) {
        map2.once('rendercomplete', function () {

            const mapCanvas = document.createElement('canvas');
            const size = map2.getSize();
            mapCanvas.width = size[0];
            mapCanvas.height = size[1];
            const mapContext = mapCanvas.getContext('2d');
            Array.prototype.forEach.call(
                map2.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'),
                function (canvas) {
                    if (canvas.width > 0) {
                        const opacity =
                            canvas.parentNode.style.opacity || canvas.style.opacity;
                        mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                        let matrix;
                        const transform = canvas.style.transform;
                        if (transform) {
                            // Get the transform parameters from the style's transform matrix
                            matrix = transform
                                .match(/^matrix\(([^\(]*)\)$/)[1]
                                .split(',')
                                .map(Number);
                        } else {
                            matrix = [
                                parseFloat(canvas.style.width) / canvas.width,
                                0,
                                0,
                                parseFloat(canvas.style.height) / canvas.height,
                                0,
                                0,
                            ];
                        }
                        // Apply the transform to the export map context
                        CanvasRenderingContext2D.prototype.setTransform.apply(
                            mapContext,
                            matrix
                        );
                        const backgroundColor = canvas.parentNode.style.backgroundColor;
                        if (backgroundColor) {
                            mapContext.fillStyle = backgroundColor;
                            mapContext.fillRect(0, 0, canvas.width, canvas.height);
                        }
                        mapContext.drawImage(canvas, 0, 0);
                    }
                }
            );
            mapContext.globalAlpha = 1;
            mapContext.setTransform(1, 0, 0, 1, 0, 0);

            const link = document.getElementById('AmapDownload');
            link.href = mapCanvas.toDataURL();
            link.click();

        });
        map2.renderSync();
    }
});
