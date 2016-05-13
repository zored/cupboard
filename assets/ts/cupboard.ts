import * as THREE from "three";
import V2 = THREE.Vector2;
import V3 = THREE.Vector3;
import Object3D = THREE.Object3D;
import Vector2 = THREE.Vector2;
import Mesh = THREE.Mesh;
import Intersection = THREE.Intersection;
import BufferGeometry = THREE.BufferGeometry;

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

        // Слушаем действия мыши
        this.mouseEventManager.startListen();

        // Заполняем сцену объектами
        this.scene.fill(this.mouseEventManager);
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

// Типы событий мыши
enum MouseEventType {
    Down,
    Up,
    Move
}

interface MouseEventsContainer {
    [type:number]:MouseCallback[]
}

interface ObjectCallbacks {
    callbacks:MouseCallback[],
    object:Object3D
}

interface MouseObjectEventsContainer {
    [type:number]:ObjectCallbacks[]
}


type MouseCallback = (event:MyMouseEvent) => void;

class MouseEventManager {
    protected objects:Object3D[] = [];
    protected raycaster:MouseRaycaster;
    protected plane:ClickPlane;
    protected objectsEvents:MouseObjectEventsContainer = {};
    protected planeEvents:MouseEventsContainer = {};

    constructor(protected canvas:Canvas, scene:Scene, protected camera:Camera) {
        this.raycaster = new MouseRaycaster(camera);
        this.plane = scene.getClickPlane();
    }

    // Устанавливаем слушателей на события мыши
    startListen() {
        this.canvas
            .getJQuery()
            .mousedown((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Down))
            .mousemove((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Move))
            .mouseup((event:JQueryMouseEventObject) => this.trigger(event, MouseEventType.Up))
        return this;
    }

    // Получить первое пересечение луча с объектом:
    protected intersect(object:Object3D):Intersection {
        return this.raycaster.intersectObject(object)[0];
    }

    // Событие при перемещении мыши
    protected trigger(jqEvent:JQueryMouseEventObject, type:MouseEventType) {
        // Получаем положение мыши
        var mouse = new V2(jqEvent.offsetX, jqEvent.offsetY);

        // Получаем относительное положение мыши на канвасе
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей
        this.raycaster.setPosition(position);

        // Событие
        let event = new MyMouseEvent();

        // Установить пересечение с плоскостью
        event.setPlaneIntersection(this.intersect(this.plane));

        // Вызываем события
        this.getPlaneCallbacks(type).forEach((callback:MouseCallback) => callback(event));

        // Для каждого объекта на сцене выполняем проверку
        this.objects.forEach((object:Object3D) => {
            // Получаем пересечение луча с объектом
            let intersection = this.intersect(object);

            // Пересечения нет
            if (!intersection || !intersection.point) {
                return;
            }

            // Устанавливаем пересечение для события
            event.setIntersection(intersection);

            // Отправляем событие объекту
            this.getObjectCallbacks(type, object).forEach((callback:MouseCallback) => callback(event));
        });
    }

    // Получить колбэки
    getObjectCallbacks(type:MouseEventType, object:Object3D):MouseCallback[] {
        if (!this.objectsEvents[type]) return [];

        let objectCallbacks = this.objectsEvents[type].filter(
            (objectCallbacks:ObjectCallbacks) => (objectCallbacks.object == object)
        )[0];

        return objectCallbacks ? objectCallbacks.callbacks : [];
    }

    getPlaneCallbacks(type:MouseEventType):MouseCallback[] {
        return this.planeEvents[type] || [];
    }

    // Добавить событие на плоскость
    onPlane(type:MouseEventType, callback:MouseCallback):MouseEventManager {
        if (!this.planeEvents[type]) this.planeEvents[type] = [];
        this.planeEvents[type].push(callback);
        return this;
    }

    // Добавить событие на объект
    onObject(type:MouseEventType, object:Object3D, callback:MouseCallback):MouseEventManager {
        if (!this.objectsEvents[type]) this.objectsEvents[type] = [];

        let objectCallbacks = this.objectsEvents[type].filter(
            (objectCallbacks:ObjectCallbacks) => (objectCallbacks.object == object)
        )[0];

        var hasListener = this.objects.some((object_:Object3D) => object_ == object);

        if (!hasListener) this.objects.push(object);

        if (!objectCallbacks) {
            this.objectsEvents[type].push({
                object: object,
                callbacks: [callback]
            });
            return this;
        }

        objectCallbacks.callbacks.push(callback);
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
        super(75, canvas.getAspect(), 0.1, 1000);

        // Сдвигаемся
        this.position.set(40, 0, 260);

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
    protected clickPlane:ClickPlane;

    constructor() {
        super();
        this.clickPlane = new ClickPlane();
        this.add(this.clickPlane);
    }

    // Заполнить сцену объектами
    fill(mouseEventManager:MouseEventManager) {
        this.adds(new Cupboard(mouseEventManager), new Light());
    }

    // Добавить все объекты
    adds(...objects:Object3D[]):THREE.Scene {
        objects.forEach((object:Object3D) => {
            this.add(object);
        });
        return this;
    }

    // Получить плоскость для клика
    getClickPlane():ClickPlane {
        return this.clickPlane;
    }
}

// Освещение
class Light extends THREE.PointLight {
    constructor() {
        super(THREE.ColorKeywords.white);
        this.position.add(new V3(200, 300, 500));
        this.intensity = 0.7;
    }
}

// Стена
class Wall extends THREE.Mesh {
    constructor(size:V3, position:V3) {
        super(
            new WallGeometry(),
            new WallMaterial()
        );

        this.scale.copy(size);
        this.position.copy(position);
    }
}

// Событие при нажатии мыши>
class MyMouseEvent {
    protected intersection:Intersection;
    protected planeIntersection:Intersection;

    // Установить пересечение мыши с плоскостью
    setPlaneIntersection(planeIntersection:Intersection):MyMouseEvent {
        this.planeIntersection = planeIntersection;
        return this;
    }

    // Получить пересечение мыши с плоскостью
    getPlaneIntersection():Intersection {
        return this.planeIntersection;
    }

    setIntersection(intersection:Intersection):MyMouseEvent {
        this.intersection = intersection;
        return this;
    }

    getIntersection():Intersection {
        return this.intersection;
    }
}

// Геометрия стены
class WallGeometry extends THREE.BoxGeometry {
    constructor() {
        super(1, 1, 1);
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

// Плоскость, по которой будут двигаться стены
class ClickPlane extends THREE.Mesh {
    constructor() {
        super(
            new THREE.PlaneBufferGeometry(2000, 2000, 8, 8),
            new THREE.MeshBasicMaterial({
                // color: 0xff0000
                visible: false
            })
        );
    }
}

class Section extends Object3D {
    public wall:Wall;

    constructor(protected size:V3, position:V3, protected thickness:number) {
        super();
        
        this.position.copy(position);
        
        this.wall = new Wall(
            size
                .clone()
                .setX(thickness),
            position
                .clone()
                .setX(position.x + size.x / 2)
        );

        this.add(this.wall);
    }
}

class Sections extends Object3D {
    protected sections:Section[] = [];
    protected sectionSize:V3;

    constructor(protected mouseEventManager:MouseEventManager,
                protected boundSize:V3,
                protected thickness:number,
                protected amount = 3,
                protected minWidth = 50) {
        super();
        this.sectionSize = boundSize.clone().setX(thickness);
        this.setAmount(amount);
    }

    setAmount(amount:number) {
        this.amount = amount;
        this.sections = [];

        let width:number = this.boundSize.x / (amount + 1),
            x:number = (width - this.boundSize.x) / 2;

        for (var i = 0; i < amount; i++) {
            var section = new Section(
                this.sectionSize,
                new V3(x, 0, 0),
                this.thickness
            );
            this.sections.push(section);
            this.add(section);
            x += width;
        }

        this.listen();
    }

    private listen() {
        this.sections.forEach((section:Section, index:number) => {
            let moving = false,
                previous:Section = this.sections[index - 1],
                next:Section = this.sections[index + 1];

            this.mouseEventManager
                .onPlane(MouseEventType.Move, (event:MyMouseEvent) => {
                    if (!moving) return;

                    var boundEdge = this.boundSize.x / 2 - this.thickness,
                        x = event.getPlaneIntersection().point.x,
                        max = next ? (next.wall.position.x - this.thickness) : boundEdge,
                        min = previous ? (previous.position.x + this.thickness) : -boundEdge;

                    x = Math.min(x, max - this.minWidth);
                    x = Math.max(x, min + this.minWidth);

                    // section.setWidth(x - min);

                    section.position.setX(x);
                })
                .onPlane(MouseEventType.Up, (event:MyMouseEvent) => {
                    moving = false;
                })
                .onObject(MouseEventType.Down, section.wall, () => {
                    moving = true;
                });
        });
    }
}

class Cupboard extends Object3D {
    protected walls:Walls;
    protected sections:Sections;

    constructor(protected mouseEventManager:MouseEventManager,
                protected size:V3 = new V3(300, 250, 60),
                protected thickness:number = 5,
                protected minSize:V3 = new V3(100, 100, 30),
                protected maxSize:V3 = new V3(500, 400, 100)) {
        super();
        this.walls = new Walls(size, thickness);
        this.sections = new Sections(mouseEventManager, size, thickness, Math.floor(Math.random() * 3 + 3));
        this.add(this.walls);
        this.add(this.sections);

        this.listen();
    }

    listen() {
        let change = new V3(),
            initPoint:V3,
            initSize:V3;

        this.mouseEventManager
            .onPlane(MouseEventType.Move, (event:MyMouseEvent) => {
                var point = event.getPlaneIntersection().point;
                for (var i = 0; i < 3; i++) {
                    var j = i == 2 ? 0 : i,
                        size = initSize.getComponent(i) + point.getComponent(j) - initPoint.getComponent(j);
                    change.getComponent(i) && this.setSizeComponent(i, size);
                }
            })
            .onPlane(MouseEventType.Up, (event:MyMouseEvent) => {
                change.set(0, 0, 0);
            })
            .onPlane(MouseEventType.Down, (event:MyMouseEvent) => {
                initPoint = event.getPlaneIntersection().point;
                initSize = this.size.clone();
            })
            .onObject(MouseEventType.Down, this.walls.right, (event:MyMouseEvent) => {
                change.x = 1;
            })
            .onObject(MouseEventType.Down, this.walls.bottom, (event:MyMouseEvent) => {
                change.y = 1;
            })
            .onObject(MouseEventType.Down, this.walls.left, (event:MyMouseEvent) => {
                change.z = 1;
            })
            .onObject(MouseEventType.Down, this.walls.top, (event:MyMouseEvent) => {
                change.z = 1;
            });
    }

    setSizeComponent(index:number, size:number):Cupboard {
        size = Math.max(size, this.minSize.getComponent(index));
        size = Math.min(size, this.maxSize.getComponent(index));
        this.size.setComponent(index, size);
        this.walls.setSizeComponent(index, size);
        return this;
    }
}

class Walls extends Object3D {
    public left:Wall;
    public right:Wall;
    public top:Wall;
    public bottom:Wall;
    public back:Wall;

    constructor(protected boundSize:V3, protected thickness:number) {
        super();

        this
            .createLeftRight(boundSize, thickness)
            .createTopBottom(boundSize, thickness)
            .createBack(boundSize, thickness);
    }

    // Левая и правая стена
    protected createLeftRight(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setX(thickness);
        let position = new V3((thickness - boundSize.x) / 2, 0, 0);
        this.left = new Wall(size, position);

        position.x *= -1;
        this.right = new Wall(size, position);

        this.add(this.left);
        this.add(this.right);
        return this;
    }

    // Верхняя и нижняя стена
    protected createTopBottom(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setY(thickness).setX(boundSize.x - thickness * 2);
        let position = new V3(0, (boundSize.y - thickness) / 2, 0);
        this.top = new Wall(size, position);
        position.y *= -1;
        this.bottom = new Wall(size, position);
        this.add(this.top);
        this.add(this.bottom);
        return this;
    }

    // Задняя стена
    protected createBack(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setZ(thickness);
        let position = new V3(0, 0, -boundSize.z / 2);
        this.back = new Wall(size, position);
        this.add(this.back);
        return this;
    }

    setSizeComponent(index:number, size:number) {
        this.boundSize.setComponent(index, size);

        let half:number = size / 2,
            resizables:Wall[] = [];

        switch (index) {
            case 0:
                this.right.position.x = half;
                this.left.position.x = -half;
                resizables = [
                    this.top,
                    this.bottom,
                    this.back
                ];
                break;

            case 1:
                this.top.position.y = half;
                this.bottom.position.y = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.back
                ];
                break;

            case 2:
                this.back.position.z = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.top,
                    this.bottom
                ];
                break;
        }

        resizables.forEach((wall:Wall) => wall.scale.setComponent(index, size));

        return this;
    }
}