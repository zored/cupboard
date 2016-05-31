import * as THREE from "three";
import V2 = THREE.Vector2;
import V3 = THREE.Vector3;
import Object3D = THREE.Object3D;
import Vector2 = THREE.Vector2;
import Mesh = THREE.Mesh;
import Intersection = THREE.Intersection;
import BufferGeometry = THREE.BufferGeometry;
import Geometry = THREE.Geometry;

// Мир шкафа
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
enum EventTypeEnum {
    MouseDown = 0,
    MouseUp = 1,
    MouseMove = 2,
    KeyDown = 3,
    KeyUp = 4,
    MouseUpGlobal = 5,
}

/**
 * Типы события
 */
class EventTypes {
    protected types:EventType[] = [];

    /**
     * Получить тип события по названию.
     *
     * @param name
     * @returns {EventType}
     */
    get(name:EventTypeEnum):EventType {
        for (let type of this.types) {
            if (type.name == name) {
                return type;
            }
        }
        return null;
    }

    /**
     * Добавить тип события
     *
     * @param eventType
     * @returns {EventTypes}
     */
    add(eventType:EventType) {
        this.types.push(eventType);

        return this;
    }

    /**
     * Выполнить все обработчики слушателя, связанные с указанным типом события и
     *
     * @param type
     * @param object
     * @param data
     * @returns {EventTypes}
     */
    trigger(type:EventTypeEnum, object:Object3D, data:EventData = null) {
        // Получаем слушателя:
        let listener:Listener = this.getListener(type, object, false);

        // Если слушателя нет, выходим:
        if (!listener) {
            return this;
        }

        // Вызываем обработчики с данными:
        listener.trigger(data);

        return this;
    }

    /**
     * Получить слушателя, связанного с данным типом события и объектом.
     *
     * @param type
     * @param object
     * @param createIfNotFound Создать тип события и слушателя, если их нет.
     * @returns {Listener}
     */
    protected getListener(type:EventTypeEnum, object:Object3D = null, createIfNotFound:boolean):Listener {
        let eventType:EventType = this.get(type);
        if (!eventType) {
            if (!createIfNotFound) {
                return null;
            }
            eventType = new EventType(type);
            this.add(eventType);
        }

        let listener:Listener = eventType.getListener(object);
        if (!listener) {
            if (!createIfNotFound) {
                return null;
            }
            listener = new Listener(object);
            eventType.addListener(listener);
        }

        return listener;
    }

    /**
     * Добавить обработчик события на объекте.
     *
     * @param type
     * @param object
     * @param handler
     * @returns {EventTypes}
     */
    on(type:EventTypeEnum, object:Object3D, handler:EventHandler) {
        // Получаем слушателя (или создаём его) и удаляем его обработчик:
        this.getListener(type, object, true).addHandler(handler);
        return this;
    }

    /**
     * Убрать обработчик события с объекта.
     *
     * @param type
     * @param object
     * @param handler
     * @returns {EventTypes}
     */
    off(type:EventTypeEnum, object:Object3D, handler:EventHandler) {
        // Получаем слушателя события:
        let listener = this.getListener(type, object, false);

        // Слушателя нет - выходим:
        if (!listener) {
            return this;
        }

        // Удаляем у слушателя обработчик:
        listener.removeHandler(handler);
        return this;
    }

    getObjects(type:EventTypeEnum):Object3D[] {
        return this.get(type).getObjects();
    }
}

class EventType {
    protected listeners:Listener[] = [];

    constructor(public name:EventTypeEnum) {
    }

    getListener(object:Object3D):Listener {
        for (let listener of this.listeners) {
            if (listener.object == object) {
                return listener;
            }
        }
        return null;
    }

    getObjects() {
        let objects:Object3D[] = [];
        for (let listener of this.listeners) {
            objects.push(listener.object);
        }
        return objects;
    }

    addListener(listener:Listener) {
        this.listeners.push(listener);
        return this;
    }
}

class Listener {
    protected handlers:EventHandler[] = [];


    constructor(public object:Object3D = null) {
    }

    trigger(data:EventData) {
        for (let handler of this.handlers) {
            handler.handle(data);
        }
        return this;
    }

    addHandler(handler:EventHandler) {
        this.handlers.push(handler);
        return this;
    }

    removeHandler(handler:EventHandler) {
        let index = this.handlers.indexOf(handler);
        if (index == -1) {
            return this;
        }

        this.handlers.splice(index, 1);
        return this;
    }
}

abstract class EventPasser {
    constructor(protected eventManager:EventManager) {

    }

    abstract listen():void;
}

class KeyboardEventPasser extends EventPasser {
    constructor(protected $window:JQuery, eventManager:EventManager) {
        super(eventManager);
    }

    listen() {
        this.$window
            .keydown(this.passToTrigger(EventTypeEnum.KeyDown))
            .keyup(this.passToTrigger(EventTypeEnum.KeyUp))
    }

    protected passToTrigger(type:EventTypeEnum) {
        return (event:JQueryKeyEventObject) => this.trigger(event, type);
    }

    private trigger(event:JQueryKeyEventObject, type:EventTypeEnum) {
        let data = new KeyBoardEventData();
        data.jquery = event;
        data.type = type;
        this.eventManager.trigger(type, data);
    }
}

class MouseEventPasser extends EventPasser {
    protected raycaster:MouseRaycaster;
    public plane:BigPlane;

    constructor(protected canvas:Canvas, scene:Scene, protected camera:Camera, eventManager:EventManager) {
        super(eventManager);
        this.raycaster = new MouseRaycaster(camera);
        this.plane = scene.getClickPlane();
    }

    /**
     * Начинаем слушать события мыши и после каждого выполням наши обработчики.
     */
    listen() {
        this.canvas.getJQuery()
            .mousedown(this.passToTrigger(EventTypeEnum.MouseDown))
            .mousemove(this.passToTrigger(EventTypeEnum.MouseMove))
            .mouseup(this.passToTrigger(EventTypeEnum.MouseUp));

        this.canvas.$window
            .mouseup(this.passToTrigger(EventTypeEnum.MouseUpGlobal))
    }

    /**
     * Позволяет пробросить событие из jQuery в наш trigger.
     *
     * @param type
     * @returns {function(JQueryMouseEventObject): void}
     */
    protected passToTrigger(type:EventTypeEnum) {
        return (event:JQueryMouseEventObject) => this.trigger(event, type);
    }

    /**
     * Получить первое пересечение луча мыши с объектом:
     *
     * @param object
     * @returns {Intersection}
     */
    intersectMouseRay(object:Object3D):Intersection {
        return this.raycaster.intersectObject(object)[0];
    }

    /**
     * Вызвать событие в EventManager
     *
     * @param jqEvent
     * @param type
     */
    protected trigger(jqEvent:JQueryMouseEventObject, type:EventTypeEnum):void {
        // Получаем положение мыши
        let mouse = new V2(jqEvent.offsetX, jqEvent.offsetY);

        // Получаем относительное положение мыши на канвасе
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей
        this.raycaster.setPosition(position);

        // Событие
        let data = new MouseEventData();

        // Установить пересечение с плоскостью
        data.setPlaneIntersection(this.intersectMouseRay(this.plane));

        // Вызываем события
        this.eventManager
            .trigger(type, data, this.plane)
            .trigger(type, data, null)
            .triggerAll(type, data, new MouseObjectEventDataModifier(this));
    }
}

abstract class ObjectEventDataModifier {
    abstract modify(data:EventData, object:Object3D):EventData;

    abstract modifyAll(data:EventData, objects:Object3D[]):Object3D[];
}

class MouseObjectEventDataModifier extends ObjectEventDataModifier {
    protected objectIntersections:ObjectIntersection[] = [];

    constructor(protected mouseEvents:MouseEventPasser) {
        super();
    }

    modify(data:MouseEventData, object:Object3D) {
        if (!object) {
            data.skip = true;
            return data;
        }

        let intersection:Intersection;
        for (let objectIntersection of this.objectIntersections) {
            if (objectIntersection.object == object) {
                intersection = objectIntersection.intersection;
                break;
            }
        }

        if (!intersection) {
            data.skip = true;
            return data;
        }

        data.setIntersection(intersection);
        return data;
    }

    modifyAll(data:EventData, objects:THREE.Object3D[]):Object3D[] {
        this.objectIntersections = [];
        
        for (let object of objects) {
            // Получаем пересечение
            let intersection = this.mouseEvents.intersectMouseRay(object);

            if (!intersection || !intersection.point) {
                continue;
            }

            this.objectIntersections.push(new ObjectIntersection(object, intersection));
        }

        return this.objectIntersections
            .sort((a:ObjectIntersection, b:ObjectIntersection) => a.intersection.distance - b.intersection.distance)
            .map((objectIntersection:ObjectIntersection) => objectIntersection.object);
    }
}

class ObjectIntersection {
    constructor(public object:THREE.Object3D,
                public intersection:THREE.Intersection) {
    }
}


class EventManager {
    protected eventTypes:EventTypes = new EventTypes;
    public mouse:MouseEventPasser;
    public keyboard:KeyboardEventPasser;

    /**
     * Добавить обработчик события на объект.
     *
     * @param type
     * @param object
     * @param handler
     * @returns {EventManager}
     */
    on(type:EventTypeEnum, object:Object3D, handler:EventHandler) {
        this.eventTypes.on(type, object, handler);
        return this;
    }

    /**
     * Убрать обработчик события с объекта.
     *
     * @param type
     * @param object
     * @param handler
     * @returns {EventManager}
     */
    off(type:EventTypeEnum, object:Object3D, handler:EventHandler) {
        this.eventTypes.off(type, object, handler);
        return this;
    }

    /**
     * Добавить / удалить обработчик события с объекта.
     *
     * @param type
     * @param object
     * @param handler
     * @param add
     * @returns {EventManager}
     */
    toggle(type:EventTypeEnum, object:Object3D, handler:EventHandler, add:boolean) {
        add
            ? this.on(type, object, handler)
            : this.off(type, object, handler);

        return this;
    }

    trigger(type:EventTypeEnum, data:EventData, object:Object3D = null) {
        this.eventTypes.trigger(type, object, data);
        return this;
    }

    triggerAll(type:EventTypeEnum, data:EventData, objectDataModifier:ObjectEventDataModifier) {
        let objects = this.eventTypes.getObjects(type);
        objects = objectDataModifier.modifyAll(data, objects);

        for (let object of objects) {
            objectDataModifier.modify(data, object);
            if (data.skip) {
                data.skip = false;
                continue;
            }
            this.eventTypes.trigger(type, object, data);

            if (data.stop) {
                data.stop = false;
                break;
            }
        }

        return this;
    }
}

// Холст
export class Canvas {
    protected size:V2;

    constructor(width:number, height:number, protected $canvas:JQuery, public $window:JQuery) {
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
        super(75, canvas.getAspect(), 0.1, 4000);

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
        this.setClearColor(0, 0);

        // Активируем тени
        this.shadowMap.enabled = true;
        this.shadowMap.type = THREE.PCFSoftShadowMap;
    }
}

// Сцена
class Scene extends THREE.Scene {
    protected clickPlane:BigPlane;

    constructor() {
        super();
        this.clickPlane = new BigPlane();
        this.add(this.clickPlane);
    }

    // Заполнить сцену объектами
    fill(eventManager:EventManager) {
        let cupboard = new Cupboard();
        this.adds(cupboard, new Lights());

        // Добавляем события:
        let listeners:ObjectListener[] = [
            new CupboardListener(cupboard, eventManager),
            (new SectionsListener(eventManager)).setSections(cupboard.sections),
            (new DoorsListener(eventManager)).setSections(cupboard.doors),
        ].concat();

        // Получаем секции полок:
        listeners = listeners.concat(
            cupboard.sections
                .getShelfSections()
                .map((sections:ShelfSections) => (new SectionsListener(eventManager)).setSections(sections))
        );

        listeners.forEach((events:ObjectListener) => events.listen(true));
    }

    // Добавить все объекты
    adds(...objects:Object3D[]):THREE.Scene {
        objects.forEach((object:Object3D) => {
            this.add(object);
        });
        return this;
    }

    // Получить плоскость для клика
    getClickPlane():BigPlane {
        return this.clickPlane;
    }
}

class Lights extends Object3D {
    constructor() {
        super();
        this.add(new MainLight());
        this.add(new THREE.AmbientLight(0x666688));
    }
}

class MainLight extends THREE.DirectionalLight {

    constructor() {
        super(0xffffee, 1);

        this.position.set(200, 300, 500);
        this.target.position.set(0, 0, 0);

        let alpha = 0,
            radius = 300;

        setInterval(() => {
            let x = Math.sin(alpha) * radius,
                y = Math.cos(alpha) * radius;

            alpha += 0.03;

            this.intensity = (Math.cos(alpha) + 1) * 0.25 + 0.5;

            this.position.setX(x).setY(y);
        }, 20);
        this.setShadowSettings();
    }

    protected setShadowSettings() {
        let size = 500;

        this.castShadow = true;


        this.shadowCameraFar = 4000;
        this.shadowCameraNear = 1;

        this.shadowBias = 0.0001;

        this.shadowCameraLeft = -size;
        this.shadowCameraRight = size;
        this.shadowCameraTop = size;
        this.shadowCameraBottom = -size;

        this.shadowMapWidth = 2048;
        this.shadowMapHeight = 2048;
    }
}

// Стена
class Wood extends THREE.Mesh {
    constructor(size:V3 = new V3(1, 1, 1), position:V3 = new V3()) {
        super(
            new WallGeometry() as any as THREE.BufferGeometry,
            new WallMaterial()
        );

        this.scale.copy(size);
        this.position.copy(position);

        this.castShadow = true;
        this.receiveShadow = true;
    }
}

class EventData {
    public skip:boolean = false;
    public stop:boolean = false;
}

// Событие при нажатии мыши>
class MouseEventData extends EventData {
    protected intersection:Intersection;
    protected planeIntersection:Intersection;

    // Установить пересечение мыши с плоскостью
    setPlaneIntersection(planeIntersection:Intersection):MouseEventData {
        this.planeIntersection = planeIntersection;
        return this;
    }

    // Получить пересечение мыши с плоскостью
    getPlaneIntersection():Intersection {
        return this.planeIntersection;
    }

    setIntersection(intersection:Intersection):MouseEventData {
        this.intersection = intersection;
        return this;
    }

    getIntersection():Intersection {
        return this.intersection;
    }
}

enum KeyCodeEnum {
    LEFT = 37,
    UP = 38,
    RIGHT = 39,
    DOWN = 40
}

class KeyBoardEventData extends EventData {
    public code:KeyCodeEnum;
    public down:boolean;
    public jquery:JQueryKeyEventObject;
    public type:EventTypeEnum;
}

// Геометрия стены
class WallGeometry extends THREE.BoxGeometry {
    constructor() {
        super(1, 1, 1);
    }
}

// Материал стены
class WallMaterial extends THREE.MeshPhongMaterial {
    protected static color = 0x7777ff;

    constructor() {
        super({
            map: THREE.ImageUtils.loadTexture('wood_1.jpg')
        });

        let index = 1;
        setInterval(() => {
            if (++index > 2) {
                index = 1;
            }
            let texture = THREE.ImageUtils.loadTexture(`wood_${index}.jpg`);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            this.map = texture;
        }, 5000);

    }
}

// Плоскость, по которой будут двигаться стены
class BigPlane extends THREE.Mesh {
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

class Section extends Object3D implements Resizable {
    public wood:Wood = null;
    protected size:V3 = new V3();
    public resizing:boolean = false;

    constructor(protected thickness:number,
                public relativeSize:number,
                protected direction:Coordinate) {
        super();

        // Добавляем стенку секции
        this.add(this.wood = new Wood());
        this.wood.scale.setComponent(direction, thickness);
    }

    deleteWall() {
        this.remove(this.wood);
        delete this.wood;
    }

    /**
     * Установить ширину
     *
     * @param index
     * @param size
     * @returns {Section}
     */
    setSizeComponent(index:Coordinate, size:number) {
        this.size.setComponent(index, size);

        // Стены нет - выходим.
        if (!this.wood) {
            return;
        }

        if (index == this.direction) {
            this.wood.position.setComponent(this.direction, size / 2);
            return;
        }

        this.wood.scale.setComponent(index, size);
    }

    setSize(size:V3):Section {
        for (let i = 0; i < 3; i++) {
            this.setSizeComponent(i, size.getComponent(i));
        }
        return this;
    }

    getWallPositionComponent(index:number) {
        return this.position.getComponent(index) + this.size.getComponent(index) / 2;
    }

    getSizeComponent(index:number) {
        return this.size.getComponent(index);
    }

    setPositionComponent(index:number, position:number) {
        this.position.setComponent(index, position);
        return this;
    }
}

abstract class ObjectListener {
    abstract listen(add:boolean):void;
}

/**
 * События секций
 */
class SectionsListener extends ObjectListener {
    protected sectionsEvents:SectionListener[] = [];
    protected sections:Sections;

    constructor(protected eventManager:EventManager) {
        super();
    }

    /**
     * Установить секции
     *
     * @param sections
     */
    setSections(sections:Sections) {
        this.listen(false);
        this.sections = sections;
        this.sections.getAll().forEach(this.addSectionEvent);
        return this;
    }

    protected addSectionEvent = (section:Section) => {
        // Создаём событие для секции:
        let sectionEvent = new SectionListener(this.eventManager, section, this.sections);

        // Добавляем его в массив:
        this.sectionsEvents.push(sectionEvent);
    };

    listen(add:boolean = true):void {
        this.sectionsEvents.forEach((event:SectionListener) => event.listen(add));
    }
}

/**
 * События дверей
 */
class DoorsListener extends SectionsListener {

    protected keyUp:DoorKeyUpHandler;

    constructor(eventManager:EventManager) {
        super(eventManager);
        this.addSectionEvent = (door:DoorSection) => {
            // Создаём событие для секции:
            let event = new DoorListener(this.eventManager, door, this.sections as DoorSections);

            // Добавляем его в массив:
            this.sectionsEvents.push(event);
        };

    }

    setSections(sections:Sections) {
        let doors = sections as DoorSections;
        this.keyUp = new DoorKeyUpHandler(doors);
        super.setSections(sections);
        return this;
    }

    listen(add:boolean = true):void {
        super.listen(add);
        this.eventManager.toggle(EventTypeEnum.KeyUp, null, this.keyUp, add);
    }
}

abstract class EventHandler {
    abstract handle(data:EventData):void;
}

class SectionWallMouseHandler extends EventHandler {
    constructor(protected section:Section,
                protected sections:Sections,
                public eventType:EventTypeEnum) {
        super();
    }

    handle(data:EventData) {
        data.stop = true;

        let resizing = (this.eventType == EventTypeEnum.MouseDown);

        if (resizing && this.sections.oneResizing) {
            return;
        }


        this.sections.setSectionResizing(this.section, resizing);
    }
}

class DoorMouseUpHandler extends EventHandler {
    constructor(protected door:DoorSection,
                protected doors:DoorSections,
                public eventType:EventTypeEnum) {
        super();
    }

    handle(data:EventData) {
        data.stop = true;
        switch (this.door.state) {
            case DoorState.Opening:
            case DoorState.Closing:
                return;

            case DoorState.Closed:
                this.open();
                break;

            case DoorState.Open:
                this.close();
                break;
        }
    }

    protected open() {
        this.door.state = DoorState.Opening;

        let direction:number,
            checkOpening:() => boolean,
            rotation = this.door.wood.rotation,
            halfPi = Math.PI * 0.47;

        switch (this.door.openType) {
            case DoorOpenType.Left:
                direction = -1;
                checkOpening = () => (rotation.y >= -halfPi);
                break;

            case DoorOpenType.Right:
                direction = 1;
                checkOpening = () => (rotation.y <= halfPi);
                break;
        }

        let speed = 0.05,
            interval = setInterval(() => {
                // Вращаем дверь:
                rotation.y += speed * direction;

                // Уменьшаем скорость открытия двери для плавности:
                speed -= 0.0003;

                // Дверь всё ещё открывается
                if (checkOpening()) {
                    return;
                }

                clearInterval(interval);
                this.door.state = DoorState.Open;
            }, 20);
    }

    private close() {
        this.door.state = DoorState.Closing;

        let direction:number,
            checkClosing:() => boolean,
            rotation = this.door.wood.rotation;

        switch (this.door.openType) {
            case DoorOpenType.Left:
                direction = 1;
                checkClosing = () => (rotation.y <= 0);
                break;

            case DoorOpenType.Right:
                direction = -1;
                checkClosing = () => (rotation.y >= 0);
                break;
        }

        let speed = 0.05,
            interval = setInterval(() => {
                // Вращаем дверь:
                rotation.y += speed * direction;

                // Уменьшаем скорость открытия двери для плавности:
                speed -= 0.0003;

                // Дверь всё ещё открывается
                if (checkClosing()) {
                    return;
                }

                clearInterval(interval);
                this.door.state = DoorState.Closed;
            }, 20);
    }
}

class DoorKeyUpHandler extends EventHandler {
    constructor(protected doors:DoorSections) {
        super();
    }

    handle(data:KeyBoardEventData):void {
        if (data.jquery.keyCode != 79) {
            return;
        }

        this.doors.toggle();
    }
}

class SectionPlaneMoveHandler extends EventHandler {
    constructor(protected section:Section,
                protected sections:Sections) {
        super();
    }

    handle(data:MouseEventData) {
        if (!this.section.resizing) return;

        let direction = this.sections.direction,
            previous:Section = this.sections.getPrevious(this.section),
            next:Section = this.sections.getNext(this.section),
            directionSize = this.sections.getDirectionSize(),
            halfDirectionSize = directionSize / 2,
            mouseCoordinate = data.getPlaneIntersection().point.getComponent(direction), // координата мыши
            minEdge = previous ? previous.getWallPositionComponent(direction) : -halfDirectionSize, // откуда считать размер
            maxCoordinate = next ? next.getWallPositionComponent(direction) : +halfDirectionSize, // максимум координаты мыши
            minCoordinate = minEdge, // минимум координаты мыши
            minSectionSize = this.sections.thickness + this.sections.minSize; // минимальный размер секции

        // Добавляем минимальный размер секции к ограничениям.
        maxCoordinate -= minSectionSize;
        minCoordinate += minSectionSize;

        // Ограничения не позволяют перемещать секцию.
        if (minCoordinate > maxCoordinate) return;

        // Ограничиваем координату мыши
        mouseCoordinate = Math.min(mouseCoordinate, maxCoordinate);
        mouseCoordinate = Math.max(mouseCoordinate, minCoordinate);

        // Устанавливаем размер секции
        let size = mouseCoordinate - minEdge,
            relativeSize = size / directionSize;

        this.sections.setRelativeSectionSizeComponent(this.section, relativeSize);
    }
}

class SectionListener extends ObjectListener {
    protected onWallDown:SectionWallMouseHandler;
    protected onPlaneUp:SectionWallMouseHandler;
    protected onPlaneMove:SectionPlaneMoveHandler;

    constructor(protected eventManager:EventManager,
                protected section:Section,
                protected sections:Sections) {
        super();
        if (this.isInvalid()) {
            return;
        }

        // Задаём обработчики событий.
        this.onWallDown = new SectionWallMouseHandler(section, sections, EventTypeEnum.MouseDown);
        this.onPlaneUp = new SectionWallMouseHandler(section, sections, EventTypeEnum.MouseUp);
        this.onPlaneMove = new SectionPlaneMoveHandler(section, sections);
    }

    /**
     * Содержимое некорректное
     *
     * @returns {boolean}
     */
    protected isInvalid() {
        return !this.section.wood;
    }

    listen(add:boolean = true) {
        if (this.isInvalid()) {
            return;
        }
        this.eventManager
            .toggle(this.onWallDown.eventType, this.section.wood, this.onWallDown, add)
            .toggle(this.onPlaneUp.eventType, this.eventManager.mouse.plane, this.onPlaneUp, add)
            .toggle(EventTypeEnum.MouseMove, this.eventManager.mouse.plane, this.onPlaneMove, add);
    }
}

class DoorListener extends SectionListener {

    protected onWoodUp:DoorMouseUpHandler;

    constructor(protected eventManager:EventManager,
                protected door:DoorSection,
                protected doors:DoorSections) {
        super(eventManager, door, doors);

        // Задаём обработчики событий.
        this.onWoodUp = new DoorMouseUpHandler(door, doors, EventTypeEnum.MouseDown);
    }


    listen(add:boolean = true) {
        this.eventManager.toggle(EventTypeEnum.MouseUp, this.door.wood, this.onWoodUp, add);
    }
}


// Внутренние секции шкафа
class Sections extends Object3D implements Resizable {
    protected sections:Section[] = [];
    public oneResizing:boolean = false;

    constructor(public direction:Coordinate,
                protected size:V3,
                public thickness:number,
                protected amount = 3,
                public minSize = 20,
                protected deleteLastWood = true) {
        super();

        // Устанавливаем изначальное количество секций:
        this.setAmount(amount);
    }

    getAll() {
        return this.sections;
    }

    setAmount(amount:number) {
        this.amount = amount;

        // Удаляем существующие секции:
        this.clear();

        // Размер всех секций:
        let sectionsSize:number = this.getDirectionSize(),
        // Размер одной секции:
            size:number = sectionsSize / amount,
        // Относительный размер секции:
            relativeSize:number = size / sectionsSize;

        for (let i = 0; i < amount; i++) {
            // Создаём секцию с заданным относительным размером:
            let section = this.createSection(relativeSize);

            // Добавляем сецию в массив секций и в объект:
            this.sections.push(section);
            this.add(section);
        }

        // Удаляем стенку / полку у последней секции
        if (this.deleteLastWood) {
            this.sections[amount - 1].deleteWall();
        }

        this.updateSectionsGeometry();
    }

    /**
     * Создать секцию
     *
     * @param relativeSize
     * @returns {Section}
     */
    protected createSection(relativeSize:number) {
        return new Section(this.thickness, relativeSize, this.direction);
    }

    /**
     * Установить, что мы перемещаем секцию.
     *
     * @param section
     * @param resizing
     * @returns {Sections}
     */
    setSectionResizing(section:Section, resizing:boolean = true) {
        section.resizing = resizing;
        this.oneResizing = resizing;
        return this;
    }

    /**
     * Установить размер секции.
     *
     * @param section
     * @param size
     * @param checkNext
     * @returns {Sections}
     */
    setRelativeSectionSizeComponent(section:Section, size:number, checkNext:boolean = true):void {
        // Изменение относительного размера:
        let deltaSize = size - section.relativeSize;

        // Устанавливаем относительный размер:
        section.relativeSize = size;

        // Если не надо проверять следующий элемент, выходим:
        if (!checkNext) {
            this.updateSectionsGeometry();
            return;
        }


        let next = this.getNext(section);
        // Следующего нет:
        if (!next) {
            this.updateSectionsGeometry();
            return;
        }

        // Устанавливаем размер следующему элементу:
        this.setRelativeSectionSizeComponent(next, next.relativeSize - deltaSize, false);

    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     */
    setSizeComponent(index:Coordinate, size:number) {
        this.size.setComponent(index, size);
        this.updateSectionsGeometry();
    }

    /**
     * Получить размер по направлению секции (горизонтальная - ширина, вертикальная - высота)
     *
     * @returns {number}
     */
    getDirectionSize() {
        return this.size.getComponent(this.direction);
    }

    /**
     * Обновить положения и размеры секций по их относительным размерам.
     *
     * @returns {Sections}
     */
    updateSectionsGeometry() {
        // Положение секции
        let position = -this.getDirectionSize() / 2;

        for (let section of this.sections) {
            // Размер секции по направлению
            let directionSize:number = this.getDirectionSize() * section.relativeSize;

            // Отодвигаем координату центра секции на половину размера.
            position += directionSize / 2;

            // Размер секции
            let sectionSize = this.size.clone();

            // Устанавливаем размер секции по направлению
            sectionSize.setComponent(this.direction, directionSize);

            // Устанавливаем размер и положение секции
            section
                .setSize(sectionSize)
                .setPositionComponent(this.direction, position);

            position += directionSize / 2;
        }
        return this;
    }

    /**
     * Очистить секции
     *
     * @returns {Sections}
     */
    protected clear() {
        // Удаляем каждую секцию из объекта:
        this.sections.forEach((section:Section) => this.remove(section));

        // Очищаем массив с секциями:
        this.sections = [];

        return this;
    }

    /**
     * Получить предыдущую секцию.
     *
     * @param section
     * @returns {Section}
     */
    getPrevious(section:Section) {
        return this.getNear(section, -1);
    }

    /**
     * Получить следующую секцию.
     *
     * @param section
     * @returns {Section}
     */
    getNext(section:Section) {
        return this.getNear(section, +1);
    }

    /**
     * Получить секцию рядом с указанной
     *
     * @param section
     * @param deltaIndex
     * @returns {Section}
     */
    protected getNear(section:Section, deltaIndex:number):Section {
        let index:number = this.sections.indexOf(section);
        if (index == -1) {
            return null;
        }
        let nearIndex:number = index + deltaIndex;
        return this.sections[nearIndex] || null;
    }
}

class DoorSections extends Sections {
    protected deleteLastWood = false;

    constructor(size:THREE.Vector3, thickness:number, amount:number = 3, minSize:number = 20) {
        super(Coordinate.X, size, thickness, amount, minSize, false);
    }

    protected createSection(relativeSize:number):Section {
        return new DoorSection(this.thickness, relativeSize, Math.round(Math.random()));
    }


    toggle() {
        this.visible = !this.visible;
    }
}

/**
 * Секции-стены
 */
class WallSections extends Sections {
    constructor(boundSize:THREE.Vector3,
                thickness:number,
                amount:number,
                minWidth:number = 20) {
        super(
            Coordinate.X,
            boundSize,
            thickness,
            amount,
            minWidth
        );
    }

    /** @inheritDoc */
    protected createSection(relativeSize:number) {
        // Создаём секцию и в ней задаём секции с полками:
        let section = new WallSection(this.thickness, relativeSize),
            shelfWidth = relativeSize * this.getDirectionSize(),
            shelves = this.createShelves(shelfWidth);

        section.setShelves(shelves);
        return section;
    }

    /**
     * Создать секцию с полками.
     *
     * @param width
     * @returns {ShelfSections}
     */
    protected createShelves(width:number) {
        // Размер секции полок:
        return new ShelfSections(
            this.size.clone().setX(width),
            this.thickness,
            Math.floor(Math.random() * 3) + 3
        );
    }

    getShelfSections():ShelfSections[] {
        return this.getAll().map((section:WallSection) => section.shelves);
    }
}


enum DoorOpenType {
    Left,
    Right
}

enum DoorState{
    Closed,
    Opening,
    Open,
    Closing
}

class DoorSection extends Section {
    public state:DoorState = DoorState.Closed;

    constructor(thickness:number, relativeSize:number, public openType:DoorOpenType) {
        super(thickness, relativeSize, Coordinate.X);
        this.setSizeComponent(Coordinate.Z, thickness);

        let translateX:number = (openType == DoorOpenType.Left ? 0.5 : -0.5);
        (this.wood.geometry as Geometry).translate(translateX, 0, 0);
    }

    setSizeComponent(index:Coordinate, size:number) {
        if (index == Coordinate.X) {
            size *= 0.97;
        }

        if (index == Coordinate.Z) {
            this.wood.position.setZ(size / 2 + this.thickness);
            size = this.thickness;
        }

        this.size.setComponent(index, size);
        this.wood.scale.setComponent(index, size);
    }


    setPositionComponent(index:number, position:number) {
        if (index == Coordinate.X) {
            let halfWidth = this.size.x / 2;
            position += (this.openType == DoorOpenType.Left ? -halfWidth : halfWidth);
        }
        super.setPositionComponent(index, position);
        return this;
    }
}

class WallSection extends Section {
    public shelves:ShelfSections;

    constructor(thickness:number, relativeSize:number) {
        super(thickness, relativeSize, Coordinate.X);
    }

    setShelves(shelves:ShelfSections) {
        this.add(this.shelves = shelves);
        return this;
    }


    setSizeComponent(index:Coordinate, size:number):void {
        super.setSizeComponent(index, size);
        this.shelves.setSizeComponent(index, size);
    }
}

/**
 * Секции полок
 */
class ShelfSections extends Sections {
    constructor(size:THREE.Vector3,
                thickness:number,
                amount:number,
                minSize:number = 20) {
        super(
            Coordinate.Y,
            size,
            thickness,
            amount,
            minSize
        );
    }
}

abstract class CupboardHandler extends EventHandler {
    constructor(protected mouseEvents:CupboardListener, protected cupboard:Cupboard) {
        super();
    }
}

class CupboardPlaneMouseMoveHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        let point = data.getPlaneIntersection().point;

        for (let index = 0; index < 3; index++) {
            this.changeComponent(index, point);
        }
    }

    protected changeComponent(index:number, point:V3) {
        if (!this.mouseEvents.changingSize.getComponent(index)) {
            return;
        }

        // Получаем размер шкафа по данному направлению:
        let previousSize = this.mouseEvents.previousSize.getComponent(index);

        // Какой компонент координаты мыши брать:
        let mouseIndex = index;

        // При изменении глубины меняем по изменению Z:
        if (index == 2) {
            mouseIndex = 1;
        }

        // Координата на плоскости:
        let planeCoordinate = point.getComponent(mouseIndex);

        // Предыдущая координата на плоскости:
        let initialPlaneCoordinate = this.mouseEvents.resizeStartPoint.getComponent(mouseIndex);

        // Изменение координаты:
        let deltaCoordinate = planeCoordinate - initialPlaneCoordinate;

        // Размер шкафа: предыдущий размер + координата
        let size = previousSize + deltaCoordinate;

        this.cupboard.setSizeComponent(index, size);
    }
}

class CupboardMouseUpHandler extends CupboardHandler {
    handle(data:EventData) {
        this.mouseEvents.changingSize.set(0, 0, 0);
    }
}

class CupboardPlaneMouseDownHandler extends CupboardHandler {
    handle(data:MouseEventData) {
        this.mouseEvents.resizeStartPoint = data.getPlaneIntersection().point;
        this.mouseEvents.previousSize = this.cupboard.size.clone();
    }
}

class WallMouseDownHandler extends CupboardHandler {
    constructor(mouseEvents:CupboardListener, cupboard:Cupboard, protected index:number) {
        super(mouseEvents, cupboard);
    }

    handle(data:EventData) {
        this.mouseEvents.changingSize.setComponent(this.index, 1);
    }
}

enum Coordinate {
    X = 0,
    Y = 1,
    Z = 2
}

class CupboardKeyHandler extends CupboardHandler {
    protected rotateInterval:number;
    protected moveInterval:number;

    handle(data:KeyBoardEventData):void {
        data.type == EventTypeEnum.KeyDown
            ? this.down(data)
            : this.up(data);
    }

    protected up(data:KeyBoardEventData):void {
        switch (data.jquery.keyCode) {
            case KeyCodeEnum.LEFT:
            case KeyCodeEnum.RIGHT:
                this.stopRotate();
                break;

            case KeyCodeEnum.UP:
            case KeyCodeEnum.DOWN:
                this.stopMove();
                break;
        }
    }

    protected down(data:KeyBoardEventData):void {
        switch (data.jquery.keyCode) {
            case KeyCodeEnum.LEFT:
                this.startRotate(+1);
                break;

            case KeyCodeEnum.RIGHT:
                this.startRotate(-1);
                break;

            case KeyCodeEnum.UP:
                this.startMove(+1);
                break;

            case KeyCodeEnum.DOWN:
                this.startMove(-1);
                break;
        }
    }

    protected stopRotate() {
        clearInterval(this.rotateInterval);
    }

    protected startRotate(multiplier:number = 1) {
        this.stopRotate();
        this.rotateInterval = setInterval(() => this.cupboard.rotation.y += 0.1 * multiplier, 20);
    }

    private startMove(multiplier:number) {
        this.stopMove();
        this.moveInterval = setInterval(() => this.cupboard.position.z += multiplier * 9, 20);
    }

    private stopMove() {
        clearInterval(this.moveInterval);
    }
}

class CupboardListener extends ObjectListener {
    protected wallDown:WallMouseDownHandler[] = [];
    protected planeMove:CupboardPlaneMouseMoveHandler;
    protected globalUp:CupboardMouseUpHandler;
    protected planeDown:CupboardPlaneMouseDownHandler;
    protected key:CupboardKeyHandler;
    public changingSize:V3 = new V3();
    public previousSize:V3;
    public resizeStartPoint:V3;

    constructor(protected cupboard:Cupboard, protected eventManager:EventManager) {
        super();
        for (var i = 0; i < 3; i++) {
            this.wallDown[i] = new WallMouseDownHandler(this, cupboard, i);
        }
        this.planeMove = new CupboardPlaneMouseMoveHandler(this, this.cupboard);
        this.globalUp = new CupboardMouseUpHandler(this, this.cupboard);
        this.planeDown = new CupboardPlaneMouseDownHandler(this, this.cupboard);
        this.key = new CupboardKeyHandler(this, this.cupboard);
    }

    listen(add:boolean = true) {
        // Невидимая огромная плоскость
        let plane = this.eventManager.mouse.plane;

        this.eventManager
            .toggle(EventTypeEnum.MouseMove, plane, this.planeMove, add)
            .toggle(EventTypeEnum.MouseUpGlobal, null, this.globalUp, add)
            .toggle(EventTypeEnum.MouseDown, plane, this.planeDown, add)
            .toggle(EventTypeEnum.KeyDown, null, this.key, add)
            .toggle(EventTypeEnum.KeyUp, null, this.key, add);

        for (let type of [
            EventTypeEnum.KeyDown,
            EventTypeEnum.KeyUp,
        ]) {
            this.eventManager.toggle(type, null, this.key, add);
        }

        let wallToCoordinate:[Wood, Coordinate][] = [
            [this.cupboard.walls.right, Coordinate.X],
            [this.cupboard.walls.bottom, Coordinate.Y],
            [this.cupboard.walls.left, Coordinate.Z],
            [this.cupboard.walls.top, Coordinate.Z],
        ];

        for (let [wall, coordinate] of wallToCoordinate) {
            this.eventManager.toggle(EventTypeEnum.MouseDown, wall, this.wallDown[coordinate], add);
        }
    }
}

class Cupboard extends Object3D implements Resizable {
    public walls:Walls;
    public sections:WallSections;
    public doors:DoorSections;
    protected resizables:Resizable[] = [];

    // Обработчики событий:

    constructor(public size:V3 = new V3(300, 250, 60),
                protected thickness:number = 3,
                protected minSize:V3 = new V3(100, 100, 30),
                protected maxSize:V3 = new V3(500, 400, 100)) {
        super();

        // Стены шкафа:
        this.walls = new Walls(size, thickness);

        // Секции с внутренними стенками и полками:
        let rand = (from:number, to:number) => Math.floor(Math.random() * (to - from) + from);
        this.sections = new WallSections(size, thickness, rand(3, 6));
        this.doors = new DoorSections(size, thickness, rand(3, 6));
        this.resizables.push(this.walls, this.sections, this.doors);

        this.add(this.walls);
        this.add(this.sections);
        this.add(this.doors);
    }

    /**
     * Установить размер.
     *
     * @param index
     * @param size
     * @returns {Cupboard}
     */
    setSizeComponent(index:Coordinate, size:number) {
        size = this.limitSize(index, size);
        this.size.setComponent(index, size);
        for (let resizable of this.resizables) {
            resizable.setSizeComponent(index, size);
        }
    }

    protected limitSize(index:Coordinate, size:number):number {
        size = Math.max(size, this.minSize.getComponent(index));
        size = Math.min(size, this.maxSize.getComponent(index));
        return size;
    }
}

interface Resizable {
    setSizeComponent(index:Coordinate, size:number):void;
}

class Walls extends Object3D implements Resizable {
    public left:Wood;
    public right:Wood;
    public top:Wood;
    public bottom:Wood;
    public back:Wood;

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
        this.left = new Wood(size, position);

        position.x *= -1;
        this.right = new Wood(size, position);

        this.add(this.left);
        this.add(this.right);
        return this;
    }

    // Верхняя и нижняя стена
    protected createTopBottom(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setY(thickness).setX(boundSize.x - thickness * 2);
        let position = new V3(0, (boundSize.y - thickness) / 2, 0);
        this.top = new Wood(size, position);
        position.y *= -1;
        this.bottom = new Wood(size, position);
        this.add(this.top);
        this.add(this.bottom);
        return this;
    }

    // Задняя стена
    protected createBack(boundSize:V3, thickness:number):Walls {
        let size = boundSize.clone().setZ(thickness);
        let position = new V3(0, 0, -boundSize.z / 2);
        this.back = new Wood(size, position);
        this.add(this.back);
        return this;
    }

    setSizeComponent(index:Coordinate, size:number) {
        this.boundSize.setComponent(index, size);

        let half:number = (size + this.thickness) * 0.5,
            resizables:Wood[] = [];

        switch (index) {
            case Coordinate.X:
                this.right.position.x = half;
                this.left.position.x = -half;
                resizables = [
                    this.top,
                    this.bottom,
                    this.back
                ];
                break;

            case Coordinate.Y:
                this.top.position.y = half;
                this.bottom.position.y = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.back
                ];
                break;

            case Coordinate.Z:
                this.back.position.z = -half;
                resizables = [
                    this.left,
                    this.right,
                    this.top,
                    this.bottom
                ];
                break;
        }

        resizables.forEach((wall:Wood) => wall.scale.setComponent(index, size));

        return this;
    }
}