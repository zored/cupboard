import {Canvas, World} from './common';
import * as $ from "jquery";

// После загрузки документа:
$(() => {
    // Окно:
    let $window = $(window);

    // Создаём холст:
    let canvas = new Canvas(
        $window.innerWidth(),
        $window.innerHeight(),
        $('<canvas>').appendTo(document.body),
        $window
    );

    // Запускаем мир:
    (new World(canvas)).start();
});