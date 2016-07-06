import {
    Reason,
    MouseReason,
    KeyboardReason,
    Reaction,
    EventType,
    KeyCodeEnum
} from "./event";

import {
    Cupboard,
    Section,
    Sections,
    DoorSections,
    Wood, OpenDoorSection
} from "./scene";

import {
    Vector3
} from "three";

import {
    CupboardHandlerSet,
    SectionsReactions
} from "./listeners";

import {
    Coordinate, Resizable
} from "./common";
import {InputHandler, IntValue, ObjectSizeInput, SectionSizeInput} from "./form";
import Object3D = THREE.Object3D;

/**
 * Обработчик событий для шкафа.
 */
abstract class AbstractCupboardHandler extends Reaction {
    constructor(event:EventType,
                protected listener:CupboardHandlerSet,
                protected cupboard:Cupboard) {
        super(event);
    }
}

/**
 * Обработчик движения мыши по плоскости для шкафа.
 */
export class CupboardPlaneMouseMoveHandler extends AbstractCupboardHandler {
    handle(data:MouseReason) {
        // Получить точку пересечения с плоскостью:
        let point = data.getPlaneIntersection().point;

        // Для каждой координаты измнить размер.
        for (let index = 0; index < 3; index++) {
            this.changeSizeComponent(index, point);
        }
    }

    /**
     * Изменить размер.
     *
     * @param index
     * @param point
     */
    protected changeSizeComponent(index:Coordinate, point:Vector3) {
        // Если у слушателя не установлено, что данный размер изменяется - выходим.
        if (!this.listener.changingSize.getComponent(index)) {
            return;
        }

        // Получаем предыдущий размер шкафа по оси:
        let previousAxisSize = this.listener.previousSize.getComponent(index);

        // Какой компонент координаты мыши брать:
        let mouseIndex = index;

        // Если меняем глубину - значение берется по оси Y:
        if (index == Coordinate.Z) {
            mouseIndex = Coordinate.Y;
        }

        // Координата по оси на плоскости:
        let planeAxisCoordinate = point.getComponent(mouseIndex);

        // Предыдущая координата по оси на плоскости:
        let initialPlaneCoordinate = this.listener.resizeStartPoint.getComponent(mouseIndex);

        // Изменение координаты по оси:
        let deltaCoordinate = planeAxisCoordinate - initialPlaneCoordinate;

        // Размер по оси для шкафа: предыдущий размер + координата
        let size = previousAxisSize + deltaCoordinate;

        // Устанавливаем размер шкафа:
        this.cupboard.setSizeComponent(index, size);
    }
}

/**
 * Обработчик щелчка мыши для шкафа.
 */
export class CupboardMouseUpHandler extends AbstractCupboardHandler {
    handle(data:Reason) {
        this.listener.changingSize.set(0, 0, 0);
    }
}

/**
 * Обработчик нажатия мыши на плоскости дял шкафа.
 */
export class CupboardPlaneMouseDownHandler extends AbstractCupboardHandler {
    handle(data:MouseReason) {
        this.listener.resizeStartPoint = data.getPlaneIntersection().point;
        this.listener.previousSize = this.cupboard.size.clone();
    }
}

/**
 * Обработчик нажатия мыши на стене.
 */
export class WallMouseDownHandler extends AbstractCupboardHandler {
    constructor(mouseEvents:CupboardHandlerSet, cupboard:Cupboard, protected index:number) {
        super(mouseEvents, cupboard);
    }

    handle(data:Reason) {
        this.listener.changingSize.setComponent(this.index, 1);
    }
}

/**
 * Обработчик событий мыши секции стены.
 */
export class SectionWallMouseHandler extends Reaction {
    constructor(protected section:Section,
                protected sections:Sections,
                public eventType:EventType) {
        super();
    }

    handle(data:Reason) {
        data.stop = true;

        let resizing = (this.eventType == EventType.MouseDown);

        if (resizing && this.sections.oneResizing) {
            return;
        }

        this.sections.setSectionResizing(this.section, resizing);
    }
}

/**
 * Обработчик наведения мыши / снятия наведения
 */
export class WoodMouseToggleHandler extends Reaction {
    constructor(public wood:Wood) {
        super();
    }

    /** @inheritDoc */
    handle(data:Reason):void {
        // Навели ли мы указатель или увели:
        let enter = (data.event == EventType.MouseEnter);

        // Наводим мышь на часть секции:
        this.wood.setHover(enter);
    }
}

/**
 * Куда открывается дверь.
 */
export enum DoorDirection {
    Left,
    Right
}

/**
 * Открыта ли дверь?
 */
export enum DoorState{
    Closed,
    Opening,
    Open,
    Closing
}

/**
 * Обработчик нажатия мыши на двери.
 */
export class OpenDoorMouseUpHandler extends Reaction {
    constructor(protected door:OpenDoorSection,
                protected doors:DoorSections,
                public eventType:EventType) {
        super();
    }

    handle(data:Reason) {
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
            case DoorDirection.Left:
                direction = -1;
                checkOpening = () => (rotation.y >= -halfPi);
                break;

            case DoorDirection.Right:
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
            case DoorDirection.Left:
                direction = 1;
                checkClosing = () => (rotation.y <= 0);
                break;

            case DoorDirection.Right:
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

                // Очищаем интервал:
                clearInterval(interval);

                // Закрываем дверь:
                this.door.state = DoorState.Closed;
            }, 20);
    }
}

/**
 * Обрабочик нажатий клавиатуры у двери.
 */
export class DoorKeyUpHandler extends Reaction {
    constructor(protected doors:DoorSections) {
        super();
    }

    handle(data:KeyboardReason):void {
        if (data.jquery.keyCode != 79) {
            return;
        }

        this.doors.toggle();
    }
}

class SectionsResizer{
    
}

/**
 * Обработчик движений мыши по плоскости для секции.
 */
export class SectionPlaneMouseMoveHandler extends Reaction {
    constructor(protected section:Section,
                protected sections:Sections,
                protected sizeInput:SectionSizeInput,
                public nextSizeInput:SectionSizeInput = null) {
        super();
    }
    
    handle(data:MouseReason) {
        if (!this.section.resizing){
            return;  
        }

        // Получаем координату мыши:
        let mousePosition = data.getPlaneIntersection().point.getComponent(this.sections.direction);

        // Установитм положение стены:
        this.sections.setOneWallPosition(this.section, mousePosition);

        // Заполняем текстовые поля:
        this.fillInputs();
    }

    /**
     * Заполнить поля ввода:
     */
    protected fillInputs(){
        // Размер секции:
        this.fillInput(this.sizeInput, this.section);
        if (!this.nextSizeInput) {
            return;
        }
        // Размер следующей секции:
        this.fillInput(this.nextSizeInput, this.nextSizeInput.object as Section);
    }

    protected fillInput(input:ObjectSizeInput, section:Section){
        input.setValue(section.relativeSize * this.sections.getDirectionSize());
        return this;
    }
}

export class DoorsCoordinateLimitChecker {
    constructor(protected sections:Sections) {

    }

    check(value:number, index:Coordinate, section:Section) {
        value = Math.min(value, this.getMax(index, section));
        value = Math.max(value, this.getMin(index, section));

        return value;
    }

    private getMax(index:Coordinate, section:Section) {
        let nextNext = this.getNextAfterNext(section);
        if (!nextNext) {
            return (this.sections.size.getComponent(index) + section.size.getComponent(index)) / 2;
        }
        return nextNext.position.getComponent(index) - nextNext.wood.scale.getComponent(index);
    }

    private getMin(index:Coordinate, section:Section) {
        let prevPrev = this.getPreviousBeforePrevious(section);
        if (!prevPrev) {
            return -(this.sections.size.getComponent(index) + section.size.getComponent(index)) / 2;
        }
        return prevPrev.position.getComponent(index) + prevPrev.wood.scale.getComponent(index);
    }

    protected getNextAfterNext(section:Section):Section {
        let next = this.sections.getNext(section);
        if (!next) {
            return null;
        }
        return this.sections.getNext(next);
    }

    protected getPreviousBeforePrevious(section:Section):Section {
        let previous = this.sections.getPrevious(section);
        if (!previous) {
            return null;
        }
        return this.sections.getPrevious(previous);

    }
}

/**
 * Обработчик движений мыши по плоскости для двери.
 */
export class SlideDoorPlaneMouseMoveHandler extends Reaction {
    protected limitChecker:DoorsCoordinateLimitChecker;

    constructor(protected door:Section,
                protected doors:Sections) {
        super();
        this.limitChecker = new DoorsCoordinateLimitChecker(doors);
    }

    handle(data:MouseReason) {
        if (!this.door.resizing) return;

        // Координата X для двери
        let x = data.getPlaneIntersection().point.x;

        x = this.limitChecker.check(x, Coordinate.X, this.door);

        // Устанавливаем координату:
        this.door.position.setX(x);
    }
}

/**
 * Обработчик клавиатуры для шкафа.
 */
export class CupboardKeyHandler extends AbstractCupboardHandler {
    protected rotateInterval:number;
    protected moveInterval:number;


    constructor(event:EventType, listener:CupboardHandlerSet, cupboard:Cupboard) {
        super(event, listener, cupboard);
    }

    /** @inheritDoc */
    handle(data:KeyboardReason):void {
        data.type == EventType.KeyDown
            ? this.down(data)
            : this.up(data);
    }

    protected up(data:KeyboardReason):void {
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

    protected down(data:KeyboardReason):void {
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

/**
 * Обработчик для установки размера объекта по указанной координатеиз поля ввода.
 */
export class ObjectSizeInputHandler extends InputHandler{
    constructor(protected object:Object3D, protected index:Coordinate) {
        super();
    }

    /** @inheritDoc */
    public handle(value:IntValue) {
        (this.object as any as Resizable).setSizeComponent(this.index, value.get());
    }
}

/**
 * Обработчик для установки размера объекта по указанной координатеиз поля ввода.
 */
export class SectionSizeInputHandler extends ObjectSizeInputHandler{
    protected next:SectionSizeInput;

    constructor(protected sections:Sections, protected section:Section, index:Coordinate) {
        super(section, index);
    }

    /** @inheritDoc */
    public handle(value:IntValue) {
        let size:number = value.get();

        if (!size) {
            return;
        }

        let relativeSize = size / this.sections.getDirectionSize();
        this.sections.setOneRelativeSize(this.object as Section, relativeSize);
        if (!this.next) {
            return;
        }
        this.next.setValue((this.next.object as Section).relativeSize * this.sections.getDirectionSize());
    }

    setNext(next:SectionSizeInput) {
        this.next = next;
        return this;
    }
}

/**
 * Обработчик для установки размера шкафа из поля ввода.
 */
export class SectionAmountInputHandler extends InputHandler{
    constructor(protected sectionsListener:SectionsReactions) {
        super();
    }

    /** @inheritDoc */
    public handle(value:IntValue) {
        this.sectionsListener.setAmount(value.get());
    }
}