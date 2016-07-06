import {
    EventManager,
    MousePassers,
    KeyboardPassers,
    EventPassers, Reactions,
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
import {ObjectSizeInput} from "./form";

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
    /**
     * Рендер.
     */
    protected renderer:Renderer;
    
    /**
     * Сцена.
     */
    protected scene:Scene;
    
    /**
     * Камера.
     */
    protected camera:Camera;
    
    /**
     * Активен ли рендер.
     * @type {boolean}
     */
    protected active:boolean = true;

    /**
     * Реакции объектов на сцене.
     */
    protected reactions:Reactions;

    constructor(protected canvas:Canvas) {
        // Создаём объекты:
        this.scene = new Scene();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera(canvas);
        this.reactions = new Reactions();
        
        // Пробрасываем события мыши и клавиатуры в реакции.
        [
            new MousePassers(canvas, this.scene.getClickPlane(), this.camera, this.reactions),
            new KeyboardPassers(canvas.$window, this.reactions)
        ].forEach((passers:EventPassers) => passers.listen());

        // Заполняем сцену объектами
        this.scene.fill().fillReactions(this.reactions);

        for(var i=0; i<3; i++) {
            let size = this.scene.cupboard.size.getComponent(i);
            (new ObjectSizeInput(this.scene.cupboard, i)).setValue(size);
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

export class Limits{
    constructor(public min:number=-Infinity, public max:number=+Infinity){
    }

    /**
     * Получить значение, принадлежащее границам. 
     *
     * @param value
     * @returns {number}
     */
    limitValue(value:number){
        value = Math.min(value, this.max);
        value = Math.max(value, this.min);
        return value;
    }

    /**
     * Правильно ли установлены лимиты.
     *
     * @returns {boolean}
     */
    correct():boolean{
        return this.max >= this.min;
    }

    shrink(value:number) {
        this.min += value;
        this.max -= value;
        return this;
    }
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