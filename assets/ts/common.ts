import {
    EventManager,
    MouseEventPasser,
    KeyboardEventPasser,
    EventPasser,
} from "./event";

import {
    Vector2,
    Vector3,
    PerspectiveCamera,
    WebGLRenderer,
    PCFSoftShadowMap,
} from "three";

import {
    Scene,
} from "./scene";
import {CupboardSizeInput} from "./form";

/**
 * Изменяет свой размер по всем координатам.
 */
export interface Resizable {
    setSizeComponent(index:Coordinate, size:number):void;
}

/**
 * Координаты.
 */
export enum Coordinate {
    X = 0,
    Y = 1,
    Z = 2
}

/**
 * Мир, в котором всё происходит.
 */
export class World {
    protected renderer:Renderer;
    protected scene:Scene;
    protected camera:Camera;
    protected active:boolean = true;
    protected eventManager:EventManager;

    constructor(protected canvas:Canvas) {
        this.scene = new Scene();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera(canvas);
        this.eventManager = new EventManager();
        this.eventManager.mouse = new MouseEventPasser(canvas, this.scene, this.camera, this.eventManager);
        this.eventManager.keyboard = new KeyboardEventPasser(canvas.$window, this.eventManager);

        [
            this.eventManager.mouse,
            this.eventManager.keyboard
        ].forEach((passer:EventPasser) => passer.listen());

        // Заполняем сцену объектами
        this.scene.fill(this.eventManager);

        for(var i=0; i<3; i++) {
            let size = this.scene.cupboard.size.getComponent(i);
            (new CupboardSizeInput(this.scene.cupboard, i)).setValue(size);
        }
        
    }

    // Каждый фрейм запускать рендер
    protected render():World {
        if (!this.active) return this;

        requestAnimationFrame(() => this.render());

        this.renderer.render(this.scene, this.camera);
        return this;
    }

    // Запустить мир
    start():World {
        this.active = true;
        return this.render();
    }

    // Остановить мир
    pause():World {
        this.active = false;
        return this;
    }
}

/**
 * Холст.
 */
export class Canvas {
    protected size:Vector2;

    constructor(width:number, height:number, protected $canvas:JQuery, public $window:JQuery) {
        this.size = new Vector2(width, height);
    }

    // Получить HTML-элемент холста
    getHTMLElement():HTMLCanvasElement {
        return <HTMLCanvasElement> this.$canvas.get(0);
    }

    // Получить размер холста
    getSize():Vector2 {
        return this.size;
    }

    // Получить отношение ширины к высоте
    getAspect():number {
        return this.size.width / this.size.height;
    }

    // Получить $canvas
    getJQuery():JQuery {
        return this.$canvas;
    }

    // Получить положение точки на холсте в относительных координатах
    getRelativePoint(position:Vector2):Vector2 {
        var point = position.clone();

        // Преобразуем координаты в относительные
        point.x = (point.x / this.size.x) * 2 - 1;
        point.y = (point.y / this.size.y) * 2 - 1;
        point.y *= -1;

        return point;
    }
}

export class Form{

}

/**
 * Камера.
 */
export class Camera extends PerspectiveCamera {
    constructor(canvas:Canvas) {
        super(75, canvas.getAspect(), 0.1, 4000);

        // Сдвигаемся
        this.position.set(40, 0, 260);

        // Смотрим в начало координат
        this.lookAt(new Vector3());
    }
}

/**
 * Рендерщик. Выводит изображение сцены с камерой на холст.
 */
export class Renderer extends WebGLRenderer {
    constructor(canvas:Canvas) {
        super({
            alpha: true,
            canvas: canvas.getHTMLElement()
        });

        // Установить размер
        this.setSize(
            canvas.getSize().width,
            canvas.getSize().height
        );

        // Задать цвет очистки
        this.setClearColor(0, 0);

        // Активируем тени
        this.shadowMap.enabled = true;
        this.shadowMap.type = PCFSoftShadowMap;
    }
}