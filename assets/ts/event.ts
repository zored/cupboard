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
     * @param reason
     */
    abstract react(reason:Reason):void;

    /**
     * Установить объект реакции.
     *
     * @param object
     * @returns {Reaction}
     */
    setObject(object:Object3D) {
        this.object = object;
        return this;
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
    protected reactions:Reaction[];

    /** @inheritDoc */
    setEnabled(enabled:boolean) {
        this.reactions.forEach((one:Reaction) => {
            one.setEnabled(enabled);
        });
        return super.setEnabled(enabled);
    }

    /**
     * Добавить реакцию.
     *
     * @param reaction
     */
    addReaction(reaction:Reaction) {
        this.reactions.push(reaction);
    }

    /**
     * Удаляем реакцию.
     *
     * @param one
     */
    remove(one:Reaction) {
        this.reactions = this.reactions.filter((reaction) => reaction != one);
    }

    /**
     * Вызвать реакцию.
     *
     * @param reason
     */
    cause(reason:Reason) {
        this.reactions
            .filter((reaction) => reason.event == reaction.event && reason.object == reaction.object)
            .forEach((reaction) => reaction.react(reason));

        return this;
    }

    /** @inheritDoc */
    react(reason:Reason) {
        // Вызвать реакцию:
        this.reactions.forEach((one) => one.react(reason));
    }

    /**
     * Получить объекты.
     * @param event
     */
    filterByEvent(event:EventType = null):Reactions {
        // Получаем реакции по типу события и для каждой реакции получаем объект:
        let filtered = new Reactions(this.event, this.object, this.enabled);

        // Функция добавления реакции:
        let addReaction = reaction => filtered.addReaction(reaction);

        // Добавляем реакции по типу события:
        this.reactions
            .filter(reaction => reaction.event == event)
            .forEach(addReaction);

        // Добавляем дочерние реакции:
        this.reactions
            .filter(reaction => reaction instanceof Reactions)
            .map((reactions:Reactions) => reactions.filterByEvent(event))
            .forEach(addReaction);

        // Получаем отфильтрованные реакции:
        return filtered;
    }

    /**
     * Вызвать все реакции.
     *
     * @param reason
     * @param modifier
     * @returns {MousePassers}
     */
    causeAll(reason:Reason, modifier:ReasonModifier) {
        // Получаем реакции по событию:
        let reactions = this.filterByEvent(reason.event);

        // Модифицируем список реакций:
        modifier.modifyReactions(reason, reactions);

        // Для каждого объекат:
        for (let object of reactions) {
            // Устанавливаем объект для причины:
            reason.setObject(object);

            // Вызываем реакцию для одного объекта:
            if (this.causeWithModifier(reason, modifier) === true) {
                break;
            }
        }

        return this;
    }

    /**
     * Вызвать реакцию для одного объекта с модиикатором:
     *
     * @param reason
     * @param modifier
     * @returns {boolean}
     */
    protected causeWithModifier(reason:Reason, modifier:ReasonModifier) {
        // Модифицируем причину для каждого объекта:
        modifier.modify(reason);

        // Пропускаем вызов реакции:
        if (reason.skip) {
            reason.skip = false;
            return;
        }

        // Вызвать реакцию:
        this.cause(reason);

        // Продолжаем выполнение:
        if (!reason.stop) {
            return;
        }

        // Остановить дальнейшее выполнение:
        reason.stop = false;
        return true;
    }

    setReactions(reactions:Reaction[]) {
        this.reactions = reactions;
    }
}

class ReactionsIntersections {
    protected intersections:ReactionIntersection[];

    constructor(protected reactions:Reactions) {
    }

    /**
     * Получить пересечения для реакций.
     *
     * @param raycaster
     */
    intersect(raycaster:MouseRaycaster) {
        this.intersections = this.reactions
            .filterByEvent()
            .map(reaction => new ReactionIntersection(reaction));
    }

    sort() {
        let reactions = this.intersections
            .sort((a, b) => a.distance - b.distance)
            .map(intersection => intersection.reaction);

        this.reactions.setReactions(reactions);
    }
}

/**
 * Пересечение объекта реакции.
 */
class ReactionIntersection {
    public intersection:Intersection;

    public distance:number = 0;

    constructor(public reaction:Reaction) {

    }

    intersect(raycaster:MouseRaycaster) {
        // Нет такой реакции или у реакции нет объекта:
        if (!this.reaction || !this.reaction.object) {
            return this;
        }

        // Получаем пересечение:
        this.intersection = raycaster.getFirstIntersection(this.reaction.object);

        // Пересечения нет - выходим:
        if (!this.intersection) {
            return this;
        }

        // Устанавливаем расстояние до пересечения:
        this.distance = this.intersection.distance;
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

    /**
     * Получить первое пересечение с объектом.
     *
     * @param object
     * @returns {Intersection}
     */
    getFirstIntersection(object:Object3D):Intersection {
        return this.intersectObject(object)[0];
    }
}

// EventPasser

/**
 * Преобразовывает событие в реакцию.
 */
export abstract class EventPassers {
    constructor(protected reactions:Reactions) {
    }

    /**
     * Все пробрасыватели.
     *
     * @type {Array}
     */
    protected all:EventPasser[] = [];

    /**
     * Начать слушать за событиями.
     */
    listen() {
        // Прослушиваем каждый пробрасыватель:
        this.all.forEach((passer) => passer.setPassers(this).listen());

        return this;
    }

    /**
     * Вызвать реакцию для причины:
     *
     * @param reason
     */
    cause(reason:Reason) {
        this.reactions.cause(reason);
    }
}

/**
 * Пробрасыватель событий мыши.
 */
export class MousePassers extends EventPassers {
    /**
     * Испускает луч от мыши в сторону объекта.
     */
    public raycaster:MouseRaycaster;

    /**
     * Изменяет причину реакции.
     */
    protected modifier:MouseModifier;

    constructor(protected canvas:Canvas,
                public plane:BigPlane,
                protected camera:Camera,
                reactions:Reactions) {
        super(reactions);
        this.raycaster = new MouseRaycaster(camera);
        this.modifier = new MouseModifier(this);

        let $canvas = this.canvas.getJQuery(),
            $window = this.canvas.$window;

        // Устанавливаем все прокидыватели событий:
        this.all = [
            new MousePasser('mousedown', EventType.MouseDown, $canvas),
            new MousePasser('mousemove', EventType.MouseMove, $canvas),
            new MousePasser('mouseup', EventType.MouseUp, $canvas),
            new MousePasser('mouseup', EventType.MouseUpGlobal, $window),
            new TouchPasser('touchstart', EventType.MouseDown, $canvas),
            new TouchPasser('touchmove', EventType.MouseMove, $canvas),
            new TouchPasser('touchend', EventType.MouseUp, $canvas),
        ];
    }


    /**
     * Вызвать событие в Reactions
     *
     * @param reason
     */
    cause(reason:MouseReason):void {
        // Получаем относительное положение мыши на канвасе:
        let position = this.canvas.getRelativePoint(reason.mouse);

        // Установить положение точки в испускателе лучей:
        this.raycaster.setPosition(position);

        // Пересечение мыши с плоскостью:
        let planeIntersection = this.raycaster.getFirstIntersection(this.plane);

        // Устанавливаем пересечение мыши с большой плоскостью:
        reason.setPlaneIntersection(planeIntersection);

        // Вызвать реакцию для плоскости и отсутствия всяких объектов:
        this.reactions
            .cause(reason.setObject(this.plane))
            .cause(reason.setObject(null))
            .causeAll(reason, this.modifier);

        // Мышь не двигали:
        if (reason.event != EventType.MouseMove) {
            return;
        }

        // Проверим наведение и увод мыши:
        this.causeEnterAndLeave(reason);
    }

    /**
     * Вызвать реакцию на движение мыши.
     *
     * @param reason
     */
    protected causeEnterAndLeave(reason:Reason) {
        // Если есть объект, на котороый навели мышь — вызываем для него реакцию с данным объектом:
        [
            this.modifier.enterIntersection,
            this.modifier.leaveIntersection
        ].forEach((intersection) => intersection && this.reactions.cause(reason.setObject(intersection.object)));

        // Убираем пересечения.
        this.modifier.enterIntersection = null;
        this.modifier.leaveIntersection = null;
    }
}

/**
 * Пробрасыватель событий.
 * Прокидывает jQuery-событие в реакции.
 */
abstract class EventPasser {
    /**
     * Хранилище пробрасывателей, которому принадлежит объект.
     */
    public passers:EventPassers;

    constructor(protected jqEvent:string,
                protected event:EventType,
                protected element:JQuery) {
    }

    /**
     * Слушаем событие:
     */
    listen() {
        this.element.on(this.jqEvent, this.causeReason);
    }

    /**
     * Установить родительский набор
     * @param passers
     * @returns {EventPasser}
     */
    setPassers(passers:EventPassers) {
        this.passers = passers;

        return this;
    }


    /**
     * Вызвать реакцию.
     *
     * @param event
     */
    protected causeReason = (event:Event) => {
        // Вызываем реакцию:
        this.passers.cause(this.getReason(event));
    };

    /**
     * Получить причину для реакции.
     *
     * @param jqEvent
     */
    protected abstract getReason(jqEvent:Event);
}

/**
 * Преобразовывает события мыши.
 */
class MousePasser extends EventPasser {
    /** @inheritDoc */
    protected getReason(jqEvent:JQueryMouseEventObject) {
        // Создаём причину:
        let reason = new MouseReason(this.event);

        // Положение мыши:
        reason.mouse = new Vector2(jqEvent.offsetX, jqEvent.offsetY);

        // Возвращаем:
        return reason;
    }
}

/**
 * Пробрасывает касание:
 */
class TouchPasser extends EventPasser {
    /** @inheritDoc */
    protected getReason(jqEvent:JQueryTouchEvent) {
        // Получаем первое касание:
        let touch = jqEvent.originalEvent.touches.item(0);

        // Касания нет:
        if (!touch) {
            return null;
        }

        // Создаём причину:
        let reason = new MouseReason(this.event);

        // Положение касания:
        reason.mouse = new Vector2(touch.pageX, touch.pageY);

        // Возвращаем причину:
        return reason;
    }
}

/**
 * Преобразовывает события мыши.
 */
class KeyboardPasser extends EventPasser {
    /** @inheritDoc */
    protected getReason(jqEvent:JQueryKeyEventObject) {
        // Создаём причину:
        return new KeyboardReason(this.event, null, jqEvent);
    }
}

/**
 * Пробрасыватель событий клавиатуры.
 */
export class KeyboardPassers extends EventPassers {
    constructor(protected $window:JQuery, reactions:Reactions) {
        super(reactions);

        this.all = [
            new KeyboardPasser('keydown', EventType.KeyDown, $window),
            new KeyboardPasser('keyup', EventType.KeyUp, $window),
        ];
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

/**
 * Событие при касании
 */
interface JQueryTouchEvent extends Event {
    originalEvent:TouchEvent,
    preventDefault:()=>void
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

    /**
     * Установить объект.
     *
     * @param object
     */
    setObject(object:Object3D) {
        this.object = object;
        return this;
    }

    /**
     * Установить событие.
     *
     * @param event
     * @returns {Reason}
     */
    setEvent(event:EventType) {
        this.event = event;
        return this;
    }
}

/**
 * Данные, передаваемые при нажатия мыши.
 */
export class MouseReason extends Reason {
    protected intersection:Intersection;
    protected planeIntersection:Intersection;
    public mouse:Vector2;

    constructor(event:EventType,
                object:THREE.Object3D = null,
                planeIntersection:THREE.Intersection = null) {
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
}

/**
 * Данные, передаваемые при нажатии на кнопку клавиатуры.
 */
export class KeyboardReason extends Reason {
    constructor(event:EventType,
                object:Object3D,
                public jquery:JQueryKeyEventObject) {
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
     */
    abstract modify(data:Reason):Reason;

    /**
     * Изменить набор реакций.
     *
     * @param reason
     * @param reactions
     */
    abstract modifyReactions(reason:Reason, reactions:Reactions):ReasonModifier;
}

/**
 * Модифицирует данные, передаваемые объекту в событии мыши.
 */
class MouseModifier extends ReasonModifier {
    /**
     * Пересечения с мышью.
     *
     * @type {Array}
     */
    protected intersections:ReactionsIntersections;

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

    /**
     * Реакции
     */
    private reactions:Reactions;

    constructor(protected mouseEvents:MousePassers) {
        super();
    }

    /** @inheritDoc */
    modify(reason:MouseReason) {
        // Объекта нет - пропускаем.
        if (!reason.object) {
            reason.skip = true;
            return reason;
        }

        // Получаем пересечение с мышью:
        let intersection = this.getIntersectionByObject(reason.object);

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
        return this.intersections.filter((intersection) => intersection.object == object)[0];
    }

    /** @inheritDoc */
    modifyReactions(reason:Reason, reactions:Reactions) {

        this.intersections = (new ReactionsIntersections(reactions))
            .intersect(this.mouseEvents.raycaster)
            .sort();

        // Установить слушателя наведения и увода мыши:
        this.setEnterLeave();

        return this;
    }

    /**
     * Установить пересечения для каждого из объектов.
     *
     * @param reactions
     */
    protected setReactions(reactions:Reactions) {

        return this;
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