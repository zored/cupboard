import {Canvas, World} from './common';
import * as $ from "jquery";

// После загрузки документа:
$(() => {
    // Окно:
    let $window = $(window);

    // Элемент холста:
    let $canvas = $('<canvas>').appendTo(document.body);

    // Объект холста:
    let canvas = new Canvas(800, 600, $canvas, $window);

    // Запускаем мир:
    (new World(canvas)).start();
});