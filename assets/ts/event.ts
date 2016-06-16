// В этом файле собраны классы для работы с событиями.

import {
    Camera,
    Canvas
} from "./common";

import {
    BigPlane,
    Scene
} from "./scene";

import {
    Object3D,
    Vector2,
    Intersection,
    Raycaster
} from "three";

/**
 * Обработчик событий.
 */
export abstract class EventHandler {
    abstract handle(data:EventData):void;
}

/**
 * Слушатель объекта.
 * Позволяет начать перехватывать события объекта или перестать это делать.
 */
export abstract class ObjectListener {
    /**
     * Начать прослушивание.
     *
     * @param enable
     */
    abstract listen(enable:boolean):void;
}

/**
 * Названия типов событий
 */
export enum EventTypeEnum {
    MouseDown,
    MouseUp,
    MouseMove,
    KeyDown,
    KeyUp,
    MouseUpGlobal,
    MouseEnter,
    MouseLeave,
}

/**
 * Кнопки клавиатуры.
 */
export enum KeyCodeEnum {
    LEFT = 37,
    UP = 38,
    RIGHT = 39,
    DOWN = 40
}

/**
 * Лучи, идущие от мыши.
 */
class MouseRaycaster extends Raycaster {
    constructor(protected camera:Camera) {
        super();
    }

    setPosition(position:Vector2):MouseRaycaster {
        this.setFromCamera(position, this.camera);
        return this;
    }
}

/**
 * Набор типов событий.
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
        // Получаем тип события, либо выходим:
        let eventType = this.get(type);
        if (!eventType) {
            return [];
        }

        // Получаем объекты из типа события:
        return eventType.getObjects();
    }
}

/**
 * Тип события.
 * Содержит
 */
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

/**
 * Слушатель события.
 */
class Listener {
    protected handlers:EventHandler[] = [];


    constructor(public object:Object3D = null) {
    }

    trigger(data:EventData) {
        for (let handler of this.handlers) {
            if (!handler) {
                continue;
            }
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

/**
 * Менеджер событий.
 * Управляет событиями.
 * Позволяет назначать их и убирать.
 */
export class EventManager {
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
        if (MouseEventPasser.notEnterOrLeave(type)){
            return this;
        }
        this.eventTypes.on(EventTypeEnum.MouseMove, object, null);
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

    triggerAll(type:EventTypeEnum, data:EventData, objectDataModifier:EventDataModifier) {
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
// EventPasser

/**
 * Пробрасыватель событий в 3D-модель событий.
 */
export abstract class EventPasser {
    constructor(protected eventManager:EventManager) {

    }

    abstract listen():void;
}

/**
 * Пробрасыватель событий мыши.
 */
export class MouseEventPasser extends EventPasser {
    protected raycaster:MouseRaycaster;
    public plane:BigPlane;
    protected dataModifier:MouseEventDataModifier;

    constructor(protected canvas:Canvas, scene:Scene, protected camera:Camera, eventManager:EventManager) {
        super(eventManager);
        this.raycaster = new MouseRaycaster(camera);
        this.plane = scene.getClickPlane();
        this.dataModifier = new MouseEventDataModifier(this);
    }

    /**
     * Начинаем слушать события мыши и после каждого выполням наши обработчики.
     */
    listen() {
        this.canvas.getJQuery().on({
            'mousedown': this.passToTrigger(EventTypeEnum.MouseDown),
            'mousemove': this.passToTrigger(EventTypeEnum.MouseMove),
            'mouseup': this.passToTrigger(EventTypeEnum.MouseUp),
            'touchstart': this.passTouchToTrigger(EventTypeEnum.MouseDown),
            'touchmove': this.passTouchToTrigger(EventTypeEnum.MouseMove),
            'touchend': this.passTouchToTrigger(EventTypeEnum.MouseUp),
        });

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
        return (event:JQueryMouseEventObject) => this.trigger(new Vector2(event.offsetX, event.offsetY), type);
    }

    /**
     * Позволяет пробросить событие из jQuery в наш trigger.
     *
     * @param type
     * @returns {function(JQueryMouseEventObject): void}
     */
    protected passTouchToTrigger(type:EventTypeEnum) {
        return (event:{originalEvent:TouchEvent, preventDefault:()=>void}) => {
            let touch:Touch = event.originalEvent.touches.item(0);
            if (!touch) {
                return;
            }
            this.trigger(new Vector2(touch.pageX, touch.pageY), type);
            event.preventDefault();
        }
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
     * @param mouse
     * @param type
     */
    protected trigger(mouse:Vector2, type:EventTypeEnum):void {
        // Получаем относительное положение мыши на канвасе
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей
        this.raycaster.setPosition(position);

        // Событие
        let data = new MouseEventData(type);

        // Установить пересечение с плоскостью
        data.setPlaneIntersection(this.intersectMouseRay(this.plane));

        // Если нужно, запускаем событие на плоскости.
        if (this.shouldTriggerPlane(type)) {
            this.eventManager.trigger(type, data, this.plane)
        }

        // Если нужно, запускаем событие без привязки к объекту.
        if (this.shouldTriggerNull(type)) {
            this.eventManager.trigger(type, data, null);
        }

        // Если нужно, запускаем событие с привязкой к объекту.
        if (!this.shouldTriggerObject(type)) {
            return;
        }

        // Получаем модификатор данных:
        let modifier = this.dataModifier;

        // Триггерим событие для всех объектов, найденных в менеджере событий:
        this.eventManager.triggerAll(type, data, modifier);

        // Не двигали мышью - выходим.
        if (type != EventTypeEnum.MouseMove) {
            return;
        }

        // Запускаем обработчики для пересечений.
        this
            .triggerIntersection(data, EventTypeEnum.MouseEnter, modifier.enterIntersection)
            .triggerIntersection(data, EventTypeEnum.MouseLeave, modifier.leaveIntersection);

        // Убираем пересечения.
        modifier.enterIntersection = modifier.leaveIntersection = null;
    }

    /**
     * Запустить обработчики для объектов, связанных с указанными пересечениями.
     *
     * @param data
     * @param type
     * @param intersection
     * @returns {MouseEventPasser}
     */
    protected triggerIntersection(data:MouseEventData, type:EventTypeEnum, intersection:Intersection) {
        // Пересечения нет:
        if (!intersection) {
            return this;
        }

        // Запускаем событие для пересечения:
        this.eventManager.trigger(type, data.setIntersection(intersection).setType(type), intersection.object);
        return this;
    }


    /**
     * Нужно ли запускать
     *
     * @param type
     * @returns {boolean}
     */
    protected shouldTriggerPlane(type:EventTypeEnum) {
        return MouseEventPasser.notEnterOrLeave(type);
    }

    /**
     * Событие не о наведении мыши и не об уведении её от объекта.
     *
     * @returns {boolean}
     */
    public static notEnterOrLeave(type:EventTypeEnum) {
        return [EventTypeEnum.MouseEnter, EventTypeEnum.MouseLeave].indexOf(type) == -1;
    }

    /**
     * Нужно ли запускать событие без объекта.
     *
     * @param type
     * @returns {boolean}
     */
    protected shouldTriggerNull(type:EventTypeEnum) {
        return MouseEventPasser.notEnterOrLeave(type);
    }

    /**
     * Нужно ли запускать событие на объекте.
     *
     * @param type
     * @returns {boolean}
     */
    protected shouldTriggerObject(type:EventTypeEnum) {
        return true;
    }
}

/**
 * Пробрасыватель событий клавиатуры.
 */
export class KeyboardEventPasser extends EventPasser {
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
        let data = new KeyBoardEventData(type);
        data.jquery = event;
        data.type = type;
        this.eventManager.trigger(type, data);
    }
}


// Touch

/**
 * Нажатие на тач-скрин.
 */
interface Touch {
    identifier:number;
    target:EventTarget;
    screenX:number;
    screenY:number;
    clientX:number;
    clientY:number;
    pageX:number;
    pageY:number;
}

/**
 * Несколько нажатий на тач-скрин.
 */
interface TouchList {
    length:number;
    item (index:number):Touch;
    identifiedTouch(identifier:number):Touch;
}

/**
 * Событие нажатия на экран
 */
interface TouchEvent extends UIEvent {
    touches:TouchList;
    targetTouches:TouchList;
    changedTouches:TouchList;
    altKey:boolean;
    metaKey:boolean;
    ctrlKey:boolean;
    shiftKey:boolean;
}


// EventData

/**
 * Данные, передаваемые в событии.
 */
export class EventData {
    public skip:boolean = false;
    public stop:boolean = false;

    constructor(public type:EventTypeEnum) {

    }
}

/**
 * Данные, передаваемые при нажатия мыши.
 */
export class MouseEventData extends EventData {
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

    /**
     * Установить пересечение.
     *
     * @param intersection
     * @returns {MouseEventData}
     */
    setIntersection(intersection:Intersection):MouseEventData {
        this.intersection = intersection;
        return this;
    }

    /**
     * Установить тип данных.
     *
     * @param type
     * @returns {MouseEventData}
     */
    setType(type:EventTypeEnum){
        this.type = type;
        return this;
    }
}

/**
 * Данные, передаваемые при нажатии на кнопку клавиатуры.
 */
export class KeyBoardEventData extends EventData {
    public code:KeyCodeEnum;
    public down:boolean;
    public jquery:JQueryKeyEventObject;
    public type:EventTypeEnum;
}


// EventData\Modifier

/**
 * Модифицирует данные, передаваемые объекту в событии.
 */
abstract class EventDataModifier {
    /**
     * Модифицировать конкретный объект.
     *
     * @param data
     * @param object
     */
    abstract modify(data:EventData, object:Object3D):EventData;

    /**
     * Модифицировать все объекты данного типа.
     *
     * @param data
     * @param objects
     */
    abstract modifyAll(data:EventData, objects:Object3D[]):Object3D[];
}

/**
 * Модифицирует данные, передаваемые объекту в событии мыши.
 */
class MouseEventDataModifier extends EventDataModifier {
    /**
     * Пересечения с мышью.
     *
     * @type {Array}
     */
    protected intersections:Intersection[] = [];

    /**
     * Пересечение для объекта, на который мы навели указатель мыши.
     */
    public enterIntersection:Intersection;

    /**
     * Пересечение для объекта, с которого мы увели указатель мыши.
     */
    public leaveIntersection:Intersection;

    /**
     * Предыдущий объект, на котором была мышь.
     */
    protected previousFirstIntersection:Intersection;

    constructor(protected mouseEvents:MouseEventPasser) {
        super();
    }

    /** @inheritDoc */
    modify(data:MouseEventData, object:Object3D) {
        // Объекта нет - пропускаем.
        if (!object) {
            data.skip = true;
            return data;
        }

        // Получаем пересечение с мышью:
        let intersection = this.getIntersectionByObject(object);

        // Пересечения нет - пропускаем.
        if (!intersection) {
            data.skip = true;
            return data;
        }

        // Добавить данные о пересечении в объект события.
        data.setIntersection(intersection);
        return data;
    }

    /**
     * Получить пересечение для объекта.
     *
     * @param object
     * @returns {Intersection}
     */
    protected getIntersectionByObject(object:Object3D):Intersection {
        for (let intersection of this.intersections) {
            if (intersection.object == object) {
                return intersection;
            }
        }

        return undefined;
    }

    /** @inheritDoc */
    modifyAll(data:EventData, objects:Object3D[]):Object3D[] {
        // Устанавливаем пересечения и вовзвращаем их объекты:
        return this.setObjectsIntersections(objects).map((intersection:Intersection) => intersection.object);
    }

    /**
     * Установить пересечения для каждого из объектов.
     *
     * @param objects
     */
    protected setObjectsIntersections(objects:Object3D[]):Intersection[] {
        // Сбрасываем пересечения.
        this.intersections = [];

        // Получаем пересечения.
        for (let object of objects) {
            if (!object) {
                continue;
            }

            // Получаем пересечение:
            let intersection = this.mouseEvents.intersectMouseRay(object);

            // Пересечения нет или нет точки пересечения:
            if (!intersection || !intersection.point) {
                continue;
            }

            // Добавляем пересечение:
            this.intersections.push(intersection);
        }

        // Сортируем от ближайшего до самого удалённого:
        let closeToFar = (a:Intersection, b:Intersection) => a.distance - b.distance;
        this.intersections.sort(closeToFar);

        // Установить слушателя наведения и увода мыши:
        this.setEnterLeave();

        return this.intersections;
    }

    /**
     * Установить объекты, на которые мы навели указатель / c которых увели указатель
     */
    protected setEnterLeave() {
        // Первое пересечение:
        let firstIntersection = this.getFirstIntersection();

        // Первый объект:
        let firstObject = firstIntersection && firstIntersection.object;

        // Предыдущий объект.
        let previousObject = this.previousFirstIntersection && this.previousFirstIntersection.object;

        // Первые объекты одинаковы:
        if (firstObject == previousObject) {
            return;
        }

        // Мышь покинула предыдущее пересечение и пересекло новое:
        this.leaveIntersection = this.previousFirstIntersection;
        this.enterIntersection = firstIntersection;

        // Устанавливаем предыдущее пересечение.
        this.previousFirstIntersection = firstIntersection;
    }

    /**
     * Получить первое пересечение.
     *
     * @returns {Intersection}
     */
    protected getFirstIntersection(): Intersection{
        let intersection = this.intersections[0];
        if (!intersection || !intersection.object) {
            return intersection;
        }
        if (intersection.object == this.mouseEvents.plane) {
            intersection = this.intersections[1];
        }
        return intersection;
    }
}