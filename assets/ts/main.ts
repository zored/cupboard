import {Canvas, World} from './common';
import * as $ from "jquery";

// После загрузки документа:
$(() => {
    // Окно:
    let $window = $(window);

    // Создаём холст:
    let canvas = new Canvas(
        800,
        600,
        $('<canvas>').appendTo(document.body),
        $window
    );

    // Запускаем мир:
    (new World(canvas)).start();
});