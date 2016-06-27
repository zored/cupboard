// В этом файле собраны классы для работы с событиями.

import {Camera, Canvas} from "./common";
import {BigPlane} from "./scene";
import {Object3D, Vector2, Intersection, Raycaster} from "three";

/**
 * Реакция.
 * Определяет, как объект будет реагировать на событие.
 */
export abstract class Reaction {
    constructor(public event:EventType = null,
                public object:Object3D = null,
                public enabled = true) {
    }

    /**
     * Активна ли реакция.
     *
     * @param enabled
     * @returns {Reaction}
     */
    setEnabled(enabled:boolean) {
        this.enabled = enabled;
        return this;
    }

    /**
     * Запустить обработчик.
     *
     * @param data
     */
    abstract react(data:Reason):void;

    /**
     * Соответсвует ли реакция причине.
     *
     * @param reason
     * @returns {boolean}
     */
    fitsReason(reason:Reason) {
        return reason.event == this.event && reason.object == this.object;
    }
}

/**
 * Набор реакций.
 *
 * Используется для того, чтобы:
 * - Массово добавить / удалить реакции.
 * - Массово включить / отключить реакции.
 * - Массово вызывать реакции.
 */
export class Reactions extends Reaction {
    constructor(public event:EventType = null,
                public object:Object3D = null,
                public enabled = true) {
        super(event, object, enabled);
    }

    /**
     * Все реакции.
     */
    protected all:Reaction[];

    /** @inheritDoc */
    setEnabled(enabled:boolean) {
        this.all.forEach((one:Reaction) => {
            one.setEnabled(enabled);
        });
        return super.setEnabled(enabled);
    }

    /**
     * Добавить реакцию.
     *
     * @param reaction
     */
    add(reaction:Reaction) {
        this.all.push(reaction);
    }

    /**
     * Удаляем реакцию.
     *
     * @param one
     */
    remove(one:Reaction) {
        this.all = this.all.filter((reaction) => reaction != one);
    }

    /**
     * Вызвать реакцию.
     *
     * @param reason
     */
    cause(reason:Reason) {
        this.all
            .filter((reaction) => reaction.fitsReason(reason))
            .forEach((reaction) => reaction.react(data);
        return this;

    }

    /** @inheritDoc */
    react(data:Reason) {
        this.all.forEach((one:Reaction) => reaction.react(data));
    }

    /**
     * Получить объекты.
     * @param event
     */
    getObjects(event:EventType) {
        // Получаем реакции по типу события и для каждой реакции получаем объект:
        this.all.filter((reaction) => reaction.event == event).map((reaction) => reaction.object);
    }
}

/**
 * Названия типов событий
 */
export enum EventType {
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

// EventPasser

/**
 * Преобразовывает событие в реакцию.
 */
export abstract class EventReasonConverters {
    constructor(protected reactions:Reactions) {
    }

    /**
     * Начать слушать за событиями.
     */
    abstract listen():void;
}

/**
 * Событие при касании
 */
type JQueryTouchEvent = {
    originalEvent:TouchEvent,
    preventDefault:()=>void
};

/**
 * Пробрасыватель событий мыши.
 */
export class MouseReasonConverter extends EventReasonConverters {
    /**
     * Испускает луч от мыши в сторону объекта.
     */
    protected raycaster:MouseRaycaster;

    /**
     * Изменяет причину реакции.
     */
    protected modifier:MouseReasonModifier;

    /**
     * Все пробрасыватели.
     *
     * @type {Array}
     */
    protected all:EventPasser[] = [];

    constructor(protected canvas:Canvas,
                public plane:BigPlane,
                protected camera:Camera,
                reactions:Reactions) {
        super(reactions);
        this.raycaster = new MouseRaycaster(camera);
        this.modifier = new MouseReasonModifier(this);

        let $canvas = this.canvas.getJQuery(),
            $window = this.canvas.$window;

        this.all = [
            new MousePasser('mousedown', EventType.MouseDown, $canvas),
            new MousePasser('mousemove', EventType.MouseMove, $canvas),
            new MousePasser('mouseup', EventType.MouseUp, $canvas),
            new TouchPasser('touchstart', EventType.MouseDown, $canvas),
            new TouchPasser('touchmove', EventType.MouseMove, $canvas),
            new TouchPasser('touchend', EventType.MouseUp, $canvas),
            new WindowPasser('mouseup', EventType.MouseUpGlobal, $window),
        ];
    }

    /**
     * Начинаем слушать события мыши и после каждого выполням наши обработчики.
     */
    listen() {

    }

    /**
     * Слушать события холста.
     *
     * @returns {MouseReasonConverter}
     */
    protected listenCanvas() {
        return this.mapObjectEvents(this.canvas.getJQuery(), {
            mousedown: EventType.MouseDown,
            mousemove: EventType.MouseMove,
            mouseup: EventType.MouseUp,
            touchstart: EventType.MouseDown,
            touchmove: EventType.MouseMove,
            touchend: EventType.MouseUp,
        });
    }

    /**
     * Слушать события окна.
     *
     * @returns {MouseReasonConverter}
     */
    protected listenWindow() {
        return this.mapObjectEvents(this.canvas.$window, {
            mouseup: EventType.MouseUpGlobal
        });
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
     * Вызвать событие в Reactions
     *
     * @param mouse
     * @param type
     */
    cause(mouse:Vector2, type:EventType):void {
        // Получаем относительное положение мыши на канвасе:
        let position = this.canvas.getRelativePoint(mouse);

        // Установить положение точки в испускателе лучей:
        this.raycaster.setPosition(position);

        // Причина реакции:
        let reason = new MouseReason(type, null, this.intersectMouseRay(this.plane));

        // Вызвать реакцию для плоскости и отсутствия всяких объектов:
        this.reactions
            .cause(reason.setObject(this.plane))
            .cause(reason.setObject(null));

        // Вызвать все реакции:
        this.causeAll(reason);

        // Не двигали мышью - выходим.
        if (type != EventType.MouseMove) {
            return;
        }

        // Запускаем обработчики для пересечений.
        this
            .triggerIntersection(reason, EventType.MouseEnter, this.modifier.enterIntersection)
            .triggerIntersection(reason, EventType.MouseLeave, this.modifier.leaveIntersection);

        // Убираем пересечения.
        this.modifier.enterIntersection = null;
        this.modifier.leaveIntersection = null;
    }

    /**
     * Вызвать все реакции.
     *
     * @param reason
     * @returns {MouseReasonConverter}
     */
    protected causeAll(reason:MouseReason) {
        let objects = this.reactions.getObjects(reason.event);

        // Модифицируем список объектов:
        objects = this.modifier.modifyAll(reason, objects);

        // Для каждого объекат:
        for (let object of objects) {
            let breakIt = this.causeOne(object, reason);
            if (breakIt === true) {
                break;
            }
        }

        return this;
    }

    protected causeOne(object:Object3D, reason:MouseReason){
        // Модифицируем причину для каждого объекта:
        this.modifier.modify(reason, object);

        // Пропускаем вызов реакции:
        if (reason.skip) {
            reason.skip = false;
            return;
        }

        // Установить объект реакции:
        reason.object = object;

        // Вызвать реакцию:
        this.reactions.cause(reason);

        // Продолжаем выполнение:
        if (!reason.stop) {
            return;
        }

        // Остановить дальнейшее выполнение:
        reason.stop = false;
        return true;
    }

    /**
     * Запустить обработчики для объектов, связанных с указанными пересечениями.
     *
     * @param reason
     * @param event
     * @param intersection
     * @returns {MouseReasonConverter}
     */
    protected triggerIntersection(reason:MouseReason, event:EventType, intersection:Intersection) {
        // Пересечения нет:
        if (!intersection) {
            return this;
        }

        // Объект причины:
        reason.object = intersection.object;

        // Событие причины:
        reason.event = event;

        // Запускаем событие для пересечения:
        this.reactions.cause(reason);

        return this;
    }
}

abstract class EventPasser{
    protected callback;

    constructor(
        protected jqEvent:string,
        protected event:EventType,
        protected element:JQuery
    ) {

    }

    listen(){
        this.element.on(this.jqEvent, this.callback);
    }

    protected abstract getCallback(){
        return this.callback;
    }
}

class MousePasser extends EventPasser{
    protected callback = (event:JQueryMouseEventObject) => {

    };

    protected abstract getCallback() {
        return this.callback;
    }
}

abstract class AbstractMouseEventMapper{
    constructor(
        protected object:JQuery,
        protected map:{[key:string]:EventType},
        protected mousePasser:MouseReasonConverter
    ) {
    }


    /**
     * Слушать события объекта.
     *
     * @param object
     * @param map
     * @returns {MouseReasonConverter}
     */
    protected apply(map:{[key:string]:EventType}) {
        // События.
        let events = {};

        // Для каждого события.
        for (let jquery:string in map) {
            let type = events[jquery];

            // Добавляем событие.
            events[jquery] = this.getPasser(type);
        }

        // Навешиваем обработчики.
        this.object.on(events);

        return this;
    }

    /**
     * @param type
     */
    protected abstract getPasser(type:EventType);
}

class MouseEventMapper extends AbstractMouseEventMapper{
    constructor(object:JQuery) {
        super(object, {
            mousedown: EventType.MouseDown,
            mousemove: EventType.MouseMove,
            mouseup: EventType.MouseUp,
            touchstart: EventType.MouseDown,
            touchmove: EventType.MouseMove,
            touchend: EventType.MouseUp,
        });
    }

    /**
     * Пробросить событие.
     *
     * @param event
     * @returns {function(JQueryMouseEventObject): void}
     */
    protected getPasser(event:EventType){
        return (jqEvent:JQueryMouseEventObject) => {
            // Положение мыши.
            let mouse = this.getMouse(jqEvent);

            // Выполняем событие.
            this.mousePasser.trigger(mouse, event);
        };
    }

    /**
     * Получить положение мыши.
     *
     * @param jqEvent
     */
    protected getMouse(jqEvent:JQueryMouseEventObject):Vector2{
        new Vector2(jqEvent.offsetX, jqEvent.offsetY)
    }
}

class SomePasser{


    constructor(
        protected mousePasser:passer
    ) {
    }

    protected pass(jqEvent:JQueryMouseEventObject){
        // Положение мыши.
        let mouse = this.getMouse(jqEvent);

        // Выполняем событие.
        this.mousePasser.trigger(mouse, this.event);
    }

    /**
     * Получить положение мыши.
     *
     * @param jqEvent
     */
    protected getMouse(jqEvent:JQueryMouseEventObject):Vector2{
        new Vector2(jqEvent.offsetX, jqEvent.offsetY)
    }
}

class TouchEventMapper extends AbstractMouseEventMapper{

    constructor(object:JQuery) {
        super(object, {
            touchstart: EventType.MouseDown,
            touchmove: EventType.MouseMove,
            touchend: EventType.MouseUp,
        });
    }

    /**
     * Пробросить событие.
     *
     * @param event
     * @returns {function(JQueryMouseEventObject): void}
     */
    protected pass(event:EventType){
        return (jqEvent:JQueryTouchEvent) => {
            // Предотвращаем дальнейшее выполнение:
            jqEvent.preventDefault();

            // Положение мыши.
            let mouse = this.getMouse(jqEvent);

            if (!mouse) {
                return;
            }

            // Выполняем событие:
            this.mousePasser.trigger(mouse, event);
        };
    }
    /**
     * Получить положение мыши.
     *
     * @param jqEvent
     */
    protected getMouse(event:JQueryTouchEvent):Vector2{
        // Получаем первое касание:
        let touch = event.originalEvent.touches.item(0);

        // Получаем положение мыши.
        new touch
            ? Vector2(touch.pageX, touch.pageY)
            : null;
    }
}

/**
 * Пробрасыватель событий клавиатуры.
 */
export class KeyboardEventConverter extends EventReasonConverters {
    constructor(protected $window:JQuery, eventManager:Reactions) {
        super(eventManager);
    }

    listen() {
        this.$window
            .keydown(this.passToCause(EventType.KeyDown))
            .keyup(this.passToCause(EventType.KeyUp))
    }

    /**
     * Пробросить событие в вызов реакции.
     *
     * @param type
     * @returns {function(JQueryKeyEventObject): void}
     */
    protected passToCause(type:EventType) {
        return (event:JQueryKeyEventObject) => this.trigger(event, type);
    }

    /**
     * Вызвать событие
     * @param event
     * @param type
     */
    private trigger(event:JQueryKeyEventObject, type:EventType) {
        // Вызвать реакцию:
        this.reactions.cause(type, new KeyboardReason(type, event));
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


// Reason

/**
 * Причина, вызывающая реакцию.
 */
export class Reason {
    /**
     * Проигнорировать причину.
     *
     * @type {boolean}
     */
    public skip:boolean = false;

    /**
     * Предотвратить остальные причины.
     *
     * @type {boolean}
     */
    public stop:boolean = false;

    constructor(public event:EventType,
                public object:Object3D = null) {

    }
}

/**
 * Данные, передаваемые при нажатия мыши.
 */
export class MouseReason extends Reason {
    protected intersection:Intersection;
    protected planeIntersection:Intersection;


    constructor(
        event:EventType,
        object:THREE.Object3D,
        planeIntersection:THREE.Intersection = null
    ) {
        super(event, object);
        this.planeIntersection = planeIntersection;
    }

// Установить пересечение мыши с плоскостью
    setPlaneIntersection(planeIntersection:Intersection):MouseReason {
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
     * @returns {MouseReason}
     */
    setIntersection(intersection:Intersection):MouseReason {
        this.intersection = intersection;
        return this;
    }

    /**
     * Установить тип данных.
     *
     * @param type
     * @returns {MouseReason}
     */
    setType(type:EventType) {
        this.event = type;
        return this;
    }

    setObject(object:Object3D) {
        this.object = object;
        return this;
    }
}

/**
 * Данные, передаваемые при нажатии на кнопку клавиатуры.
 */
export class KeyboardReason extends Reason {
    constructor(event:EventType,
                object:Object3D,
                public jquery:JQueryKeyEventObject,) {
        super(event, object);
    }
}


// ReasonModifier

/**
 * Модифицирует данные, передаваемые объекту в событии.
 */
abstract class ReasonModifier {
    /**
     * Модифицировать конкретный объект.
     *
     * @param data
     * @param object
     */
    abstract modify(data:Reason, object:Object3D):Reason;

    /**
     * Модифицировать все объекты данного типа.
     *
     * @param data
     * @param objects
     */
    abstract modifyAll(data:Reason, objects:Object3D[]):Object3D[];
}

/**
 * Модифицирует данные, передаваемые объекту в событии мыши.
 */
class MouseReasonModifier extends ReasonModifier {
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

    constructor(protected mouseEvents:MouseReasonConverter) {
        super();
    }

    /** @inheritDoc */
    modify(reason:MouseReason, object:Object3D) {
        // Объекта нет - пропускаем.
        if (!object) {
            reason.skip = true;
            return reason;
        }

        // Получаем пересечение с мышью:
        let intersection = this.getIntersectionByObject(object);

        // Пересечения нет - пропускаем.
        if (!intersection) {
            reason.skip = true;
            return reason;
        }

        // Добавить данные о пересечении в объект события.
        reason.setIntersection(intersection);
        return reason;
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
    modifyAll(data:Reason, objects:Object3D[]):Object3D[] {
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
    protected getFirstIntersection():Intersection {
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