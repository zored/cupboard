import * as THREE from "three";
import V2 = THREE.Vector2;
import V3 = THREE.Vector3;
import Object3D = THREE.Object3D;
import Vector2 = THREE.Vector2;

// Мир шкафа
export class World {
    protected renderer:Renderer;
    protected scene:Scene;
    protected camera:Camera;
    protected active:boolean = true;
    protected mouseEventManager:MouseEventManager;

    constructor(protected canvas:Canvas) {
        this.scene = new Scene();
        this.renderer = new Renderer(canvas);
        this.camera = new Camera(canvas);
        this.mouseEventManager = new MouseEventManager(this.canvas, this.scene, this.camera);

        this.scene.onAdd((object:Object3D) => this.mouseEventManager.addListeners([object]));

        // Слушаем действия мыши
        this.mouseEventManager.listen();

        // Заполняем сцену объектами
        this.scene.fill();
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

class MouseRaycaster extends THREE.Raycaster {
    constructor(protected camera:Camera) {
        super();
    }

    setPosition(position:THREE.Vector2):MouseRaycaster {
        this.setFromCamera(position, this.camera);
        return this;
    }
}

class MouseEventManager {
    protected objects:Object3D[];
    protected raycaster:MouseRaycaster;

    constructor(protected canvas:Canvas, scene:Scene, protected camera:Camera) {
        this.objects = this.getListeners(scene.children);
        this.raycaster = new MouseRaycaster(camera);
    }

    // Устанавливаем слушателей на события мыши
    listen() {
        this.canvas
            .getJQuery()
            .mousedown((event:JQueryMouseEventObject) => this.move(event));
        return this;
    }

    // Событие при перемещении мыши
    protected move(jqEvent:JQueryMouseEventObject) {
        // Получаем положение мыши
        var mouse = new V2(jqEvent.offsetX, jqEvent.offsetY);

        // Получаем относительное положение мыши на канвасе
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей
        this.raycaster.setPosition(position);

        // Событие
        let event = new MouseDownEvent();

        // Для каждого объекта на сцене выполняем проверку
        this.objects.forEach((object:Object3DWithEvents) => {
            // Получаем пересечение луча с объектом
            let intersection = this.raycaster.intersectObject(object)[0];

            // Пересечения нет
            if (!intersection || !intersection.point) {
                return;
            }

            // Устанавливаем пересечение для события
            event.setIntersection(intersection);

            // Отправляем событие объекту
            object.mouseEvents.onMouseDown(event);
        });
    }

    // Получить объекты, отслеживающие нажатия мыши
    getListeners(children:Object3D[]):Object3D[] {
        // Получаем слушателей среди дочерних объектов
        var childListeners = children.filter((object:Object3DWithEvents) => !!object.mouseEvents);

        // Добавляем к этому результату слушателей среди дочерних элементов дочерних элементов
        return children.reduce((result:Object3D[], child:Object3D) => {
            return result.concat(this.getListeners(child.children));
        }, childListeners);
    }

    // Добавить слушаетелей
    addListeners(objects:Object3D[]):MouseEventManager {
        this.objects = this.objects.concat(this.getListeners(objects));
        return this;
    }
}

// Холст
export class Canvas {
    protected size:V2;

    constructor(width:number, height:number, protected $canvas:JQuery) {
        this.size = new V2(width, height);
    }

    // Получить HTML-элемент холста
    getHTMLElement():HTMLCanvasElement {
        return <HTMLCanvasElement> this.$canvas.get(0);
    }

    // Получить размер холста
    getSize():V2 {
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

// Камера
class Camera extends THREE.PerspectiveCamera {
    constructor(canvas:Canvas) {
        super(20, canvas.getAspect(), 0.1, 1000);

        // Сдвигаемся
        this.position.add(new V3(
            300,
            300,
            300
        ));

        // Смотрим в начало координат
        this.lookAt(new V3());
    }
}

// Рендерщик. Выводит изображение сцены с камерой на холст.
class Renderer extends THREE.WebGLRenderer {
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
        this.setClearColor(0xffffff, 0);
    }
}

// Сцена
class Scene extends THREE.Scene {
    protected onAddCallbacks:Function[];

    add(object:THREE.Object3D):void {
        super.add(object);
        this.onAddCallbacks.forEach((callback: (object:Object3D) => void) => callback(object));
    }

    // Действие при добавлении объекта на сцену
    onAdd(callback:(object:Object3D) => void): Scene{
        this.onAddCallbacks.push(callback);
        return this;
    }

    // Заполнить сцену объектами
    fill(){
        var wall = new Wall();
        wall.mouseEvents = new CubeClickEvents(this);
        this.adds(wall, new Light());
    }

    // Добавить все объекты
    adds(...objects:Object3D[]):THREE.Scene {
        objects.forEach((object:Object3D) => {
            this.add(object);
        });
        return this;
    }
}

// Освещение
class Light extends THREE.PointLight {
    constructor() {
        super(THREE.ColorKeywords.white);
        this.position.add(new V3(300, 200, -300));
    }
}

class MouseEvents {
    public onMouseDown(event:MouseDownEvent) {
        console.log(event);
    }
}

class CubeClickEvents extends MouseEvents {
    constructor(protected scene:Scene) {
        super();
    }

    public onMouseDown(event:MouseDownEvent) {
        var wall = new Wall();
        wall.position.copy(event.getIntersection().point.clone());
        wall.mouseEvents = this;
        this.scene.add(wall);
    }
}

class Object3DWithEvents extends Object3D {
    public mouseEvents:MouseEvents;
}

// Стена
class Wall extends THREE.Mesh {
    public mouseEvents:MouseEvents;

    constructor() {
        super(
            new WallGeometry(new V3(50, 50, 50)),
            new WallMaterial()
        );
    }
}

class MouseDownEvent {
    protected intersection:THREE.Intersection;

    setIntersection(intersection:THREE.Intersection) {
        this.intersection = intersection;
        return this;
    }

    getIntersection():THREE.Intersection {
        return this.intersection;
    }
}

// Геометрия стены
class WallGeometry extends THREE.BoxGeometry {
    constructor(protected size:V3) {
        super(size.x, size.y, size.z);
    }
}

// Материал стены
class WallMaterial extends THREE.MeshLambertMaterial {
    constructor() {
        super({
            color: 0xff0000
        });
    }
}