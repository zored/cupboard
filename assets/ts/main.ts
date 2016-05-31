import cupboard = require('./cupboard');
import $ = require('jquery');
import THREE = require('three');

$(() => {
    // Канвас для вывода
    var $canvas = $('<canvas>').appendTo(document.body),
        
        $window = $(window),
        
        // Объект канваса
        canvas = new cupboard.Canvas($window.innerWidth(), $window.innerHeight(), $canvas, $window),

        // Создаём мир шкафа
        world = new cupboard.World(canvas);

    // Запускаем мир
    world.start();
});